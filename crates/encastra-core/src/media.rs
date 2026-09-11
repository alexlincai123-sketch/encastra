//! Image decoding, encoding and resizing.
//!
//! This lives in the runtime rather than in a component because the *type system* promises it:
//! `file -> image` is a declared conversion, and something has to be able to perform it. Keeping
//! the codec in one place also keeps the limits in one place.
//!
//! # Limits are not optional
//!
//! Image decoding is the classic way to turn a small file into gigabytes of memory: a 30 KB PNG
//! can declare 60,000 × 60,000 pixels and ask the decoder to allocate 14 GB before a single
//! pixel is read. Every entry point here checks the declared dimensions *before* decoding and
//! caps what the decoder may allocate. A file that exceeds a limit is an ordinary component
//! error, not a crash and not a hang.

use std::io::Cursor;

use image::{DynamicImage, ImageFormat, ImageReader, imageops::FilterType};

/// The largest input this build will read. Well above any real photograph or screenshot.
pub const MAX_INPUT_BYTES: usize = 256 * 1024 * 1024;

/// The largest image this build will decode, in pixels. 100 megapixels is roughly a 10,000 ×
/// 10,000 image — larger than any camera output and far larger than anything a workflow that
/// resizes for the web needs.
pub const MAX_PIXELS: u64 = 100_000_000;

/// What the decoder may allocate. Belt and braces with [`MAX_PIXELS`]: the dimension check
/// catches a declared size, and this catches anything that slips past it.
const MAX_DECODER_ALLOC: u64 = 512 * 1024 * 1024;

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum MediaError {
    #[error("this file is {size} bytes, and the limit is {limit}")]
    TooLarge { size: usize, limit: usize },
    #[error("this image is {width}×{height}, which is {pixels} pixels; the limit is {limit}")]
    TooManyPixels {
        width: u32,
        height: u32,
        pixels: u64,
        limit: u64,
    },
    #[error("this file is not an image format this build can read")]
    UnknownFormat,
    #[error("the image could not be read: {0}")]
    Undecodable(String),
    #[error("the image could not be written as {format}: {reason}")]
    Unencodable { format: String, reason: String },
    #[error("{0} is not a size this build can produce")]
    UnsupportedOutput(String),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ImageInfo {
    pub width: u32,
    pub height: u32,
    pub format: &'static str,
}

/// Reads the header only. Cheap, and safe on a file that has not been vetted.
pub fn probe(bytes: &[u8]) -> Result<ImageInfo, MediaError> {
    if bytes.len() > MAX_INPUT_BYTES {
        return Err(MediaError::TooLarge {
            size: bytes.len(),
            limit: MAX_INPUT_BYTES,
        });
    }

    let reader = ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()
        .map_err(|e| MediaError::Undecodable(e.to_string()))?;

    let format = reader.format().ok_or(MediaError::UnknownFormat)?;
    let (width, height) = reader
        .into_dimensions()
        .map_err(|e| MediaError::Undecodable(e.to_string()))?;

    check_pixels(width, height)?;
    Ok(ImageInfo {
        width,
        height,
        format: format_name(format),
    })
}

/// Decodes, having first checked what the header claims.
pub fn decode(bytes: &[u8]) -> Result<DynamicImage, MediaError> {
    // Probe first so an absurd declared size is refused before any allocation happens.
    probe(bytes)?;

    let mut reader = ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()
        .map_err(|e| MediaError::Undecodable(e.to_string()))?;

    let mut limits = image::Limits::default();
    limits.max_alloc = Some(MAX_DECODER_ALLOC);
    limits.max_image_width = Some(65_535);
    limits.max_image_height = Some(65_535);
    reader.limits(limits);

    reader
        .decode()
        .map_err(|e| MediaError::Undecodable(e.to_string()))
}

fn check_pixels(width: u32, height: u32) -> Result<(), MediaError> {
    let pixels = u64::from(width) * u64::from(height);
    if pixels > MAX_PIXELS {
        return Err(MediaError::TooManyPixels {
            width,
            height,
            pixels,
            limit: MAX_PIXELS,
        });
    }
    Ok(())
}

fn format_name(format: ImageFormat) -> &'static str {
    match format {
        ImageFormat::Png => "png",
        ImageFormat::Jpeg => "jpeg",
        ImageFormat::Gif => "gif",
        ImageFormat::WebP => "webp",
        ImageFormat::Bmp => "bmp",
        ImageFormat::Tiff => "tiff",
        ImageFormat::Ico => "ico",
        _ => "other",
    }
}

/// How a resize treats the box it is given.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FitMode {
    /// Fit inside the box, keeping the aspect ratio. The result may be smaller in one axis.
    Contain,
    /// Fill the box, keeping the aspect ratio, cropping the overflow.
    Cover,
    /// Exactly the given size, distorting if necessary.
    Stretch,
}

impl FitMode {
    pub fn parse(name: &str) -> Option<Self> {
        Some(match name {
            "contain" => FitMode::Contain,
            "cover" => FitMode::Cover,
            "stretch" => FitMode::Stretch,
            _ => return None,
        })
    }
}

/// Resizes to fit the given box.
///
/// Either dimension may be zero, meaning "whatever keeps the proportions". Both zero is
/// refused: an image with no size is not a useful answer.
pub fn resize(
    image: &DynamicImage,
    width: u32,
    height: u32,
    mode: FitMode,
) -> Result<DynamicImage, MediaError> {
    let (source_width, source_height) = (image.width(), image.height());
    if source_width == 0 || source_height == 0 {
        return Err(MediaError::Undecodable("the image has no pixels".into()));
    }

    let (target_width, target_height) = match (width, height) {
        (0, 0) => return Err(MediaError::UnsupportedOutput("0×0".into())),
        (w, 0) => {
            let scale = f64::from(w) / f64::from(source_width);
            (
                w,
                ((f64::from(source_height) * scale).round() as u32).max(1),
            )
        }
        (0, h) => {
            let scale = f64::from(h) / f64::from(source_height);
            (((f64::from(source_width) * scale).round() as u32).max(1), h)
        }
        (w, h) => (w, h),
    };

    check_pixels(target_width, target_height)?;

    // Lanczos3 for downscaling: this is a tool people use to produce final assets, and a fast
    // but soft filter would show. The cost is milliseconds on anything realistic.
    Ok(match mode {
        FitMode::Contain => image.resize(target_width, target_height, FilterType::Lanczos3),
        FitMode::Cover => image.resize_to_fill(target_width, target_height, FilterType::Lanczos3),
        FitMode::Stretch => image.resize_exact(target_width, target_height, FilterType::Lanczos3),
    })
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OutputFormat {
    Png,
    Jpeg,
    WebP,
}

impl OutputFormat {
    pub fn parse(name: &str) -> Option<Self> {
        Some(match name.to_ascii_lowercase().as_str() {
            "png" => OutputFormat::Png,
            "jpeg" | "jpg" => OutputFormat::Jpeg,
            "webp" => OutputFormat::WebP,
            _ => return None,
        })
    }

    pub fn extension(self) -> &'static str {
        match self {
            OutputFormat::Png => "png",
            OutputFormat::Jpeg => "jpg",
            OutputFormat::WebP => "webp",
        }
    }

    pub fn name(self) -> &'static str {
        match self {
            OutputFormat::Png => "png",
            OutputFormat::Jpeg => "jpeg",
            OutputFormat::WebP => "webp",
        }
    }
}

/// Encodes an image. `quality` is used by JPEG only, and is clamped to 1–100.
pub fn encode(
    image: &DynamicImage,
    format: OutputFormat,
    quality: u8,
) -> Result<Vec<u8>, MediaError> {
    let mut out = Cursor::new(Vec::new());

    let fail = |e: image::ImageError| MediaError::Unencodable {
        format: format.name().to_owned(),
        reason: e.to_string(),
    };

    match format {
        OutputFormat::Png => image.write_to(&mut out, ImageFormat::Png).map_err(fail)?,
        OutputFormat::WebP => image.write_to(&mut out, ImageFormat::WebP).map_err(fail)?,
        OutputFormat::Jpeg => {
            // JPEG has no alpha. Writing an RGBA image without saying so produces a file that
            // looks wrong rather than an error, so the conversion is explicit here.
            let rgb = DynamicImage::ImageRgb8(image.to_rgb8());
            let mut encoder =
                image::codecs::jpeg::JpegEncoder::new_with_quality(&mut out, quality.clamp(1, 100));
            encoder.encode_image(&rgb).map_err(fail)?;
        }
    }

    Ok(out.into_inner())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn png(width: u32, height: u32) -> Vec<u8> {
        let image = DynamicImage::ImageRgba8(image::RgbaImage::from_pixel(
            width,
            height,
            image::Rgba([200, 120, 60, 255]),
        ));
        encode(&image, OutputFormat::Png, 90).unwrap()
    }

    #[test]
    fn probes_without_decoding() {
        let info = probe(&png(64, 32)).unwrap();
        assert_eq!((info.width, info.height, info.format), (64, 32, "png"));
    }

    #[test]
    fn refuses_something_that_is_not_an_image() {
        let error = probe(b"this is plain text, not a picture").unwrap_err();
        // The message has to make sense to somebody who connected the wrong file.
        assert!(
            matches!(
                error,
                MediaError::UnknownFormat | MediaError::Undecodable(_)
            ),
            "{error}"
        );
        assert!(!error.to_string().contains("panic"));
    }

    #[test]
    fn refuses_a_declared_size_that_would_exhaust_memory() {
        // A decompression bomb: a tiny file that claims an enormous canvas. The check happens
        // on the header, so nothing is allocated.
        let mut header = png(1, 1);
        // PNG IHDR width/height are big-endian u32 at offset 16 and 20.
        header[16..20].copy_from_slice(&60_000u32.to_be_bytes());
        header[20..24].copy_from_slice(&60_000u32.to_be_bytes());

        match probe(&header) {
            Err(MediaError::TooManyPixels { limit, .. }) => assert_eq!(limit, MAX_PIXELS),
            // A corrupted CRC may make the header unreadable first, which is also a refusal.
            Err(MediaError::Undecodable(_)) => {}
            other => panic!("a 60000x60000 image must not be accepted: {other:?}"),
        }
    }

    #[test]
    fn refuses_a_file_larger_than_the_limit_without_reading_it() {
        let huge = vec![0u8; MAX_INPUT_BYTES + 1];
        assert!(matches!(probe(&huge), Err(MediaError::TooLarge { .. })));
    }

    #[test]
    fn resizing_keeps_proportions_when_one_axis_is_left_open() {
        let image = decode(&png(800, 400)).unwrap();

        let contained = resize(&image, 200, 0, FitMode::Contain).unwrap();
        assert_eq!((contained.width(), contained.height()), (200, 100));

        let by_height = resize(&image, 0, 100, FitMode::Contain).unwrap();
        assert_eq!((by_height.width(), by_height.height()), (200, 100));
    }

    #[test]
    fn cover_fills_the_box_and_stretch_distorts_it() {
        let image = decode(&png(800, 400)).unwrap();
        let cover = resize(&image, 300, 300, FitMode::Cover).unwrap();
        assert_eq!((cover.width(), cover.height()), (300, 300));

        let stretch = resize(&image, 300, 300, FitMode::Stretch).unwrap();
        assert_eq!((stretch.width(), stretch.height()), (300, 300));
    }

    #[test]
    fn a_resize_cannot_be_used_to_create_a_bomb_either() {
        let image = decode(&png(10, 10)).unwrap();
        assert!(matches!(
            resize(&image, 60_000, 60_000, FitMode::Stretch),
            Err(MediaError::TooManyPixels { .. })
        ));
        assert!(matches!(
            resize(&image, 0, 0, FitMode::Contain),
            Err(MediaError::UnsupportedOutput(_))
        ));
    }

    #[test]
    fn every_output_format_round_trips() {
        let image = decode(&png(40, 20)).unwrap();
        for format in [OutputFormat::Png, OutputFormat::Jpeg, OutputFormat::WebP] {
            let bytes = encode(&image, format, 85).unwrap();
            let info = probe(&bytes).unwrap_or_else(|e| panic!("{}: {e}", format.name()));
            assert_eq!((info.width, info.height), (40, 20), "{}", format.name());
        }
    }

    #[test]
    fn jpeg_drops_alpha_deliberately_rather_than_producing_a_wrong_looking_file() {
        let transparent = DynamicImage::ImageRgba8(image::RgbaImage::from_pixel(
            8,
            8,
            image::Rgba([10, 20, 30, 0]),
        ));
        let bytes = encode(&transparent, OutputFormat::Jpeg, 90).unwrap();
        assert_eq!(probe(&bytes).unwrap().format, "jpeg");
    }

    #[test]
    fn format_names_and_extensions_agree_with_what_a_person_would_type() {
        assert_eq!(OutputFormat::parse("JPG"), Some(OutputFormat::Jpeg));
        assert_eq!(OutputFormat::parse("jpeg"), Some(OutputFormat::Jpeg));
        assert_eq!(OutputFormat::parse("PNG"), Some(OutputFormat::Png));
        assert_eq!(OutputFormat::parse("tiff"), None);
        assert_eq!(OutputFormat::Jpeg.extension(), "jpg");
    }
}
