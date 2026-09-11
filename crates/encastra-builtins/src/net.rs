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
        ctx.check_http(&url.host)?;

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
            format!("{method} {} responded {status}.", url.host),
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

    let host = authority
        .rsplit_once(':')
        .map(|(h, _port)| h)
        .unwrap_or(authority)
        .trim_matches(['[', ']'])
        .to_ascii_lowercase();

    if host.is_empty() {
        return Err(bad("it has no host"));
    }

    Ok(UrlParts { scheme, host })
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
    fn refuses_the_shapes_that_would_make_the_permission_check_a_lie() {
        // Credentials would land in the journal and in the prompt.
        assert!(url_parts("https://user:pass@evil.example/").is_err());
        // Nothing to check a permission against.
        assert!(url_parts("https:///path").is_err());
        assert!(url_parts("example.com/path").is_err());
        assert!(url_parts("ftp://example.com").is_err());
        assert!(url_parts("file:///etc/passwd").is_err());
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
