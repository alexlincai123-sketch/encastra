//! Making a request.
//!
//! This is the component where the capability model earns its keep. `net.http` is granted per
//! node **and per host**: allowing a component to call `api.example.com` does not allow it to
//! call anywhere else, and an empty allowlist means nothing rather than everything.
//!
//! The request is also constrained before it leaves: no redirects to a host that was not
//! allowed, a response size limit, and a timeout. A component that could be pointed at an
//! internal address and follow a redirect somewhere else is the shape of an SSRF.

use std::sync::{Arc, LazyLock};
use std::time::Duration;

use encastra_core::journal::{LogLevel, NodeError};
use encastra_core::runner::{CoreComponent, NodeContext};
use encastra_core::value::Value;
use encastra_protocol::manifest::ComponentManifest;

use crate::{Outputs, manifest, required_config};

/// Enough for an API response; not enough for somebody to fill memory with a download.
const MAX_RESPONSE_BYTES: u64 = 16 * 1024 * 1024;

const TIMEOUT: Duration = Duration::from_secs(30);

static HTTP: LazyLock<ComponentManifest> = LazyLock::new(|| {
    manifest(
        r#"{
        "schema": 1,
        "id": "encastra.net.http",
        "version": "1.0.0",
        "name": "HTTP Request",
        "description": "Fetches a web address, or sends data to one.",
        "category": "network",
        "runtime": ">=0.1.0",
        "kind": "core",
        "ports": {
          "inputs":  {
            "body": { "type": "string", "label": "Body",
                      "doc": "Sent with POST, PUT and PATCH. Ignored by GET." }
          },
          "outputs": {
            "body":   { "type": "string", "label": "Response" },
            "status": { "type": "i64", "label": "Status code" },
            "ok":     { "type": "bool", "label": "Succeeded" }
          }
        },
        "config": {
          "url":          { "type": "string", "required": true, "label": "Address",
                            "doc": "Must be https unless you allow plain http below." },
          "method":       { "type": "string", "choices": ["GET", "POST", "PUT", "PATCH", "DELETE"], "label": "Method" },
          "content_type": { "type": "string", "label": "Content type",
                            "doc": "For example application/json." },
          "allow_http":   { "type": "bool", "label": "Allow plain http",
                            "doc": "Off by default. Plain http can be read and changed in transit." }
        },
        "capabilities": [
          { "kind": "net.http", "scope": "allowed-hosts",
            "reason": "Contacts the specific web addresses you allow, and no others." }
        ],
        "platforms": ["windows", "macos", "linux"]
      }"#,
    )
});

struct Http;

impl CoreComponent for Http {
    fn manifest(&self) -> &ComponentManifest {
        &HTTP
    }

    fn run(&self, ctx: &mut NodeContext<'_>) -> Result<Outputs, NodeError> {
        let raw_url = required_config(ctx, "url")?;
        let url = url_parts(&raw_url)?;

        if url.scheme == "http" && !ctx.config_bool("allow_http").unwrap_or(false) {
            return Err(NodeError::new(
                "insecure-url",
                "This address uses plain http, which can be read and changed in transit.",
            )
            .with_hint(
                "Use https, or turn on \"Allow plain http\" if you know the address is safe.",
            ));
        }

        // The host check is the permission. It happens before anything is sent, and it is
        // recorded in the journal whichever way it goes.
        ctx.check_http(&url.authority())?;

        let method = ctx
            .config_str("method")
            .unwrap_or("GET")
            .to_ascii_uppercase();
        let body = match ctx.input("body") {
            Some(Value::Text(t)) => Some(t.clone()),
            _ => None,
        };

        let agent = ureq::Agent::config_builder()
            .timeout_global(Some(TIMEOUT))
            // Redirects are the SSRF vector: a permitted host can hand back a Location
            // pointing anywhere, including an address inside the machine. Refusing to follow
            // them keeps "allowed hosts" meaning what it says.
            .max_redirects(0)
            .build()
            .new_agent();

        let response = send(&agent, &method, &raw_url, body.as_deref(), ctx)?;
        let status = i64::from(response.0);
        let ok = (200..300).contains(&status);

        ctx.log(
            LogLevel::Info,
            format!("{method} {} responded {status}.", url.authority()),
        );

        Ok(Outputs::from([
            ("body".to_owned(), Value::Text(response.1)),
            ("status".to_owned(), Value::Int(status)),
            ("ok".to_owned(), Value::Bool(ok)),
        ]))
    }
}

fn send(
    agent: &ureq::Agent,
    method: &str,
    url: &str,
    body: Option<&str>,
    ctx: &NodeContext<'_>,
) -> Result<(u16, String), NodeError> {
    let content_type = ctx
        .config_str("content_type")
        .map(str::trim)
        .filter(|t| !t.is_empty())
        .unwrap_or("application/json")
        .to_owned();

    let result = match method {
        "GET" => agent.get(url).call(),
        "DELETE" => agent.delete(url).call(),
        "POST" | "PUT" | "PATCH" => {
            let payload = body.unwrap_or("");
            let request = match method {
                "POST" => agent.post(url),
                "PUT" => agent.put(url),
                _ => agent.patch(url),
            };
            request.header("content-type", &content_type).send(payload)
        }
        other => {
            return Err(NodeError::new(
                "unsupported-method",
                format!("{other} is not a method this component sends."),
            ));
        }
    };

    let mut response = match result {
        Ok(response) => response,
        // A non-2xx status is an answer, not a failure to communicate. The component reports
        // it and lets the graph decide, because "the server said 404" is often the useful
        // result rather than a reason to stop.
        Err(ureq::Error::StatusCode(code)) => {
            return Ok((code, String::new()));
        }
        Err(error) => {
            return Err(NodeError::new("request-failed", describe(&error))
                .with_hint("Check the address, and that this machine can reach it.")
                .retryable());
        }
    };

    let status = response.status().as_u16();
    let text = response
        .body_mut()
        .with_config()
        .limit(MAX_RESPONSE_BYTES)
        .read_to_string()
        .map_err(|error| {
            NodeError::new(
                "response-too-large",
                format!("The response could not be read: {}.", describe_read(&error)),
            )
            .with_hint("Responses above 16 MB are refused.")
        })?;

    Ok((status, text))
}

/// The kind of failure, never the full error.
///
/// A transport error's message can contain the whole URL, and a URL can contain a token in a
/// query string. This runs on addresses the user typed.
fn describe(error: &ureq::Error) -> String {
    match error {
        ureq::Error::Timeout(_) => "The request took too long and was stopped.".into(),
        ureq::Error::ConnectionFailed => "The connection could not be made.".into(),
        ureq::Error::HostNotFound => "That address could not be found.".into(),
        ureq::Error::TooManyRedirects => {
            "The address redirected somewhere that was not allowed.".into()
        }
        ureq::Error::Io(e) => format!("The connection failed ({}).", e.kind()),
        _ => "The request failed.".into(),
    }
}

fn describe_read(error: &ureq::Error) -> String {
    match error {
        ureq::Error::BodyExceedsLimit(limit) => format!("it is larger than {limit} bytes"),
        ureq::Error::Io(e) => format!("{}", e.kind()),
        _ => "the body could not be read".into(),
    }
}

struct UrlParts {
    scheme: String,
    host: String,
    /// Set only when the address names a port that is not the scheme's own.
    port: Option<u16>,
}

impl UrlParts {
    /// What the permission check is made against.
    ///
    /// The host alone when the address uses the scheme's own port, `host:port` otherwise. The
    /// port has to be part of the identity because it is part of what gets reached: a grant for
    /// `internal.example` that also admitted `internal.example:22` and `internal.example:5432`
    /// is not a permission to talk to a web service, it is a permission to reach every service
    /// on that machine. Nobody answering the dialog means the second one.
    ///
    /// Bare host for the default port, so the common case reads as a host and a grant already
    /// made for `example.com` keeps working.
    fn authority(&self) -> String {
        match self.port {
            Some(port) => format!("{}:{port}", self.host),
            None => self.host.clone(),
        }
    }
}

/// Pulls the scheme and host out without a URL parsing dependency.
///
/// Deliberately strict: anything it cannot understand is refused rather than guessed at,
/// because the host it extracts is what the permission check is made against. A parser that
/// disagreed with the one making the request would be a way to reach a host that was never
/// allowed.
fn url_parts(url: &str) -> Result<UrlParts, NodeError> {
    let bad = |why: &str| {
        NodeError::new("bad-url", format!("That address is not usable: {why}."))
            .with_hint("It should look like https://example.com/path.")
    };

    let (scheme, rest) = url
        .split_once("://")
        .ok_or_else(|| bad("it has no https:// or http://"))?;
    let scheme = scheme.to_ascii_lowercase();
    if scheme != "https" && scheme != "http" {
        return Err(bad("only https and http are supported"));
    }

    let authority = rest.split(['/', '?', '#']).next().unwrap_or("");
    if authority.is_empty() {
        return Err(bad("it has no host"));
    }

    // Credentials in a URL would put a password in the journal and in the permission prompt.
    if authority.contains('@') {
        return Err(NodeError::new(
            "bad-url",
            "Addresses with a user name and password in them are not accepted.",
        )
        .with_hint("Send credentials as a header or in the body instead."));
    }

    // An IPv6 literal is bracketed and full of colons, so the port has to be looked for after the
    // closing bracket. Splitting at the last colon regardless — which is what this did — turns
    // `[::1]` into a host of `:`, so an IPv6 address could never be named in a grant and never
    // match one.
    let (host_text, port_text) = if let Some(rest) = authority.strip_prefix('[') {
        let (inside, after) = rest
            .split_once(']')
            .ok_or_else(|| bad("the IPv6 address has no closing bracket"))?;
        (inside, after.strip_prefix(':'))
    } else {
        match authority.rsplit_once(':') {
            Some((host, port)) => (host, Some(port)),
            None => (authority, None),
        }
    };

    // A trailing dot is the same name to DNS. Removing it here keeps this parser and the
    // editor's agreeing on one spelling, which is what makes comparing them meaningful.
    let host = host_text
        .trim_end_matches('.')
        .to_ascii_lowercase();

    if host.is_empty() {
        return Err(bad("it has no host"));
    }

    let default_port = if scheme == "https" { 443 } else { 80 };
    let port = match port_text {
        None | Some("") => None,
        Some(text) => {
            let given: u16 = text.parse().map_err(|_| bad("the port is not a number"))?;
            // Recorded only when it differs, so `https://example.com:443` and
            // `https://example.com` are one address and not two.
            (given != default_port).then_some(given)
        }
    };

    Ok(UrlParts { scheme, host, port })
}

pub fn http() -> Arc<dyn CoreComponent> {
    Arc::new(Http)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_host_used_for_the_permission_check_is_the_real_one() {
        assert_eq!(
            url_parts("https://api.example.com/v1/x").unwrap().host,
            "api.example.com"
        );
        assert_eq!(
            url_parts("https://API.Example.COM").unwrap().host,
            "api.example.com"
        );
        assert_eq!(
            url_parts("https://example.com:8443/x").unwrap().host,
            "example.com"
        );
        assert_eq!(
            url_parts("http://localhost:5173").unwrap().host,
            "localhost"
        );
    }

    #[test]
    fn a_grant_for_a_host_is_not_a_grant_for_every_port_on_it() {
        // Allowing "internal.example" is a decision about a web service. If the port fell out of
        // the identity, the same grant would also admit :22, :5432, :6379 and everything else
        // that machine happens to answer on — turning one permission into a port scanner.
        assert_eq!(
            url_parts("https://internal.example/").unwrap().authority(),
            "internal.example"
        );
        assert_eq!(
            url_parts("https://internal.example:6379/").unwrap().authority(),
            "internal.example:6379"
        );
        assert_eq!(
            url_parts("https://internal.example:22/").unwrap().authority(),
            "internal.example:22"
        );

        // The scheme's own port is not a different address, so an existing grant still works.
        assert_eq!(
            url_parts("https://example.com:443/x").unwrap().authority(),
            "example.com"
        );
        assert_eq!(
            url_parts("http://example.com:80/x").unwrap().authority(),
            "example.com"
        );

        // And a port that is not a number is refused rather than quietly ignored.
        assert!(url_parts("https://example.com:eighty/").is_err());
        assert!(url_parts("https://example.com:99999/").is_err());
    }

    #[test]
    fn an_ipv6_literal_is_a_host_and_not_a_colon() {
        // Splitting at the last colon regardless turned "[::1]" into a host of ":", so an IPv6
        // address could never be named in a grant nor matched against one.
        assert_eq!(url_parts("http://[::1]/").unwrap().host, "::1");
        assert_eq!(url_parts("http://[::1]/").unwrap().authority(), "::1");
        assert_eq!(
            url_parts("http://[::1]:8080/").unwrap().authority(),
            "::1:8080"
        );
        assert_eq!(
            url_parts("https://[2001:db8::1]/x").unwrap().host,
            "2001:db8::1"
        );
        assert!(url_parts("http://[::1/").is_err());
    }

    #[test]
    fn a_trailing_dot_is_the_same_host() {
        // Otherwise "example.com." and "example.com" are two spellings of one name, and the two
        // parsers that have to agree — this one and the editor's — could disagree about which.
        assert_eq!(
            url_parts("https://example.com./x").unwrap().host,
            "example.com"
        );
    }

    #[test]
    fn refuses_the_shapes_that_would_make_the_permission_check_a_lie() {
        // Each shape is refused for its own reason. Asserting only `is_err()` would let a
        // regression that broke the scheme allowlist pass, as long as the address happened to
        // fail some other check on the way past.
        let credentials = url_parts("https://user:hunter2@evil.example/")
            .unwrap_err_or_else_message("an address carrying credentials must be refused");
        assert!(
            credentials.contains("user name and password"),
            "{credentials}"
        );
        // The refusal must not repeat back what it refused, or the password is now in the
        // journal that this check exists to keep it out of.
        assert!(!credentials.contains("hunter2"), "{credentials}");

        for (address, reason) in [
            ("https:///path", "it has no host"),
            ("example.com/path", "no https:// or http://"),
            ("ftp://example.com", "only https and http"),
            ("file:///etc/passwd", "only https and http"),
            ("javascript://example.com", "only https and http"),
        ] {
            let err = url_parts(address)
                .unwrap_err_or_else_message(&format!("{address} must be refused"));
            assert!(
                err.contains(reason),
                "{address} refused for the wrong reason: {err}"
            );
        }
    }

    /// `unwrap_err` on a `Result<UrlParts, NodeError>`, returning the message.
    ///
    /// `UrlParts` is not `Debug`, so the built-in `unwrap_err` will not compile here.
    trait UnwrapErrMessage {
        fn unwrap_err_or_else_message(self, context: &str) -> String;
    }

    impl UnwrapErrMessage for Result<UrlParts, NodeError> {
        fn unwrap_err_or_else_message(self, context: &str) -> String {
            match self {
                Ok(_) => panic!("{context}"),
                Err(error) => error.message,
            }
        }
    }

    #[test]
    fn a_failed_request_never_says_where_it_was_going() {
        // A URL can carry a token in its query string, and these strings land in the journal,
        // which is rendered on screen and pasted into bug reports. The error says what kind of
        // failure it was and nothing about the address.
        let secret = "https://api.example.com/v1?api_key=SUPER_SECRET_VALUE";
        let io = ureq::Error::Io(std::io::Error::new(
            std::io::ErrorKind::ConnectionRefused,
            format!("failed connecting to {secret}"),
        ));

        let described = describe(&io);
        assert!(!described.contains("SUPER_SECRET_VALUE"), "{described}");
        assert!(!described.contains("api.example.com"), "{described}");
        assert!(described.contains("connection refused"), "{described}");

        let read = describe_read(&io);
        assert!(!read.contains("SUPER_SECRET_VALUE"), "{read}");
        assert!(!read.contains("api.example.com"), "{read}");

        // A size refusal says the size, which is not a secret, and still not the address.
        let too_big = describe_read(&ureq::Error::BodyExceedsLimit(MAX_RESPONSE_BYTES));
        assert!(too_big.contains(&MAX_RESPONSE_BYTES.to_string()), "{too_big}");
    }

    #[test]
    fn a_path_that_looks_like_a_host_does_not_become_one() {
        // The host is what comes before the first slash, not anything later in the path.
        assert_eq!(
            url_parts("https://allowed.example/redirect?to=evil.example")
                .unwrap()
                .host,
            "allowed.example"
        );
        assert_eq!(
            url_parts("https://allowed.example#evil.example")
                .unwrap()
                .host,
            "allowed.example"
        );
    }
}
