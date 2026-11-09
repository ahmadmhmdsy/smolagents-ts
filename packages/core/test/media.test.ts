import { describe, expect, it } from "vitest";
import { ContentTooLargeError, UnsupportedContentError } from "../src/errors.js";
import {
  DEFAULT_MEDIA_LIMITS,
  MEDIA_TYPES,
  checkContentParts,
  checkMessageMedia,
  encodeBase64,
  hasMedia,
  messageText,
  sniffMediaType,
} from "../src/media.js";
import type { AudioPart, ContentPart, ImagePart } from "../src/types.js";

const SIGNATURES = {
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  jpeg: [0xff, 0xd8, 0xff, 0xe0],
  gif: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
  webp: [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50],
  wav: [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45],
  id3: [0x49, 0x44, 0x33, 0x04],
  mpegFrame: [0xff, 0xfb, 0x90, 0x00],
  adts: [0xff, 0xf1, 0x50, 0x80],
};

function bytes(signature: readonly number[], size = signature.length): Uint8Array {
  const out = new Uint8Array(size);
  out.set(signature);
  return out;
}

function image(size?: number): ImagePart {
  return { type: "image", mediaType: "image/png", bytes: bytes(SIGNATURES.png, size) };
}

const WAV: AudioPart = { type: "audio", mediaType: "audio/wav", format: "wav", bytes: bytes(SIGNATURES.wav) };
const BOTH = { images: true, audio: true };

describe("messageText and hasMedia", () => {
  it("returns a string as it is", () => {
    expect(messageText({ content: "hi" })).toBe("hi");
    expect(hasMedia({ content: "hi" })).toBe(false);
  });

  it("joins text parts and leaves media out", () => {
    const content: ContentPart[] = [{ type: "text", text: "a" }, image(), { type: "text", text: "b" }];
    expect(messageText({ content })).toBe("a\nb");
    expect(hasMedia({ content })).toBe(true);
  });

  it("does not call a text part media", () => {
    expect(hasMedia({ content: [{ type: "text", text: "a" }] })).toBe(false);
  });
});

describe("sniffMediaType", () => {
  it.each([
    ["image/png", SIGNATURES.png],
    ["image/jpeg", SIGNATURES.jpeg],
    ["image/gif", SIGNATURES.gif],
    ["image/webp", SIGNATURES.webp],
    ["audio/wav", SIGNATURES.wav],
    ["audio/mpeg", SIGNATURES.id3],
    ["audio/mpeg", SIGNATURES.mpegFrame],
  ])("reads %s from its signature", (mediaType, signature) => {
    expect(sniffMediaType(bytes(signature))).toBe(mediaType);
  });

  it("covers every type on the allowlist", () => {
    const shown = Object.values(SIGNATURES).map((signature) => sniffMediaType(bytes(signature)));
    for (const mediaType of MEDIA_TYPES) expect(shown).toContain(mediaType);
  });

  it("does not take AAC in ADTS framing for an mp3", () => {
    expect(sniffMediaType(bytes(SIGNATURES.adts))).toBeUndefined();
  });

  it("shows nothing for bytes it does not know, or for none", () => {
    expect(sniffMediaType(new TextEncoder().encode("<svg></svg>"))).toBeUndefined();
    expect(sniffMediaType(new Uint8Array())).toBeUndefined();
  });

  it("does not take a RIFF container of another kind for media", () => {
    expect(sniffMediaType(bytes([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x41, 0x56, 0x49, 0x20]))).toBeUndefined();
  });
});

describe("checkContentParts", () => {
  it("skips text and admits declared media", () => {
    expect(checkContentParts([{ type: "text", text: "a".repeat(100) }], { images: false, audio: false })).toBe(0);
    expect(checkContentParts([image()], BOTH)).toBe(12);
    expect(checkContentParts([WAV], BOTH)).toBe(16);
  });

  it("refuses a modality the model does not declare", () => {
    expect(() => checkContentParts([image()], { images: false, audio: true })).toThrow(UnsupportedContentError);
    expect(() => checkContentParts([WAV], { images: true, audio: false })).toThrow(UnsupportedContentError);
  });

  it("names the media type on the error", () => {
    let caught: unknown;
    try {
      checkContentParts([image()], { images: false, audio: false });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(UnsupportedContentError);
    expect((caught as UnsupportedContentError).mediaType).toBe("image/png");
  });

  it("refuses a type off the list, an SVG above all", () => {
    const svg = {
      type: "image",
      mediaType: "image/svg+xml",
      bytes: new TextEncoder().encode("<svg></svg>"),
    } as unknown as ContentPart;
    expect(() => checkContentParts([svg], BOTH)).toThrow(UnsupportedContentError);
  });

  it("refuses a media type on the wrong kind of part", () => {
    const wrong = { type: "image", mediaType: "audio/wav", bytes: bytes(SIGNATURES.wav) } as unknown as ContentPart;
    expect(() => checkContentParts([wrong], BOTH)).toThrow(UnsupportedContentError);
  });

  it("refuses an audio format that does not match its media type", () => {
    expect(() => checkContentParts([{ ...WAV, format: "mp3" }], BOTH)).toThrow(UnsupportedContentError);
  });

  it("refuses bytes that do not match the declared type", () => {
    const disguised: ImagePart = { type: "image", mediaType: "image/png", bytes: bytes(SIGNATURES.jpeg) };
    expect(() => checkContentParts([disguised], BOTH)).toThrow(UnsupportedContentError);
  });

  it("refuses a part over its limit, counted once encoded", () => {
    const limits = { maxPartBytes: 16, maxRunBytes: 1000 };
    expect(checkContentParts([image(12)], BOTH, limits)).toBe(16);

    let caught: unknown;
    try {
      // 13 raw bytes encode to 20, so a raw count would have passed this one.
      checkContentParts([image(13)], BOTH, { ...limits, maxPartBytes: 19 });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ContentTooLargeError);
    expect((caught as ContentTooLargeError).byteLength).toBe(20);
    expect((caught as ContentTooLargeError).limit).toBe(19);
  });

  it("refuses a run over its limit across calls", () => {
    const limits = { maxPartBytes: 100, maxRunBytes: 30 };
    const spent = checkContentParts([image(12)], BOTH, limits);
    expect(spent).toBe(16);
    expect(() => checkContentParts([image(12)], BOTH, limits, spent)).toThrow(ContentTooLargeError);
  });

  it("defaults to five mebibytes a part and twenty a run", () => {
    expect(DEFAULT_MEDIA_LIMITS).toEqual({ maxPartBytes: 5 * 1024 * 1024, maxRunBytes: 20 * 1024 * 1024 });
  });
});

describe("encodeBase64", () => {
  it("encodes the RFC 4648 vectors", () => {
    const encode = (text: string): string => encodeBase64(new TextEncoder().encode(text));
    expect(encode("")).toBe("");
    expect(encode("f")).toBe("Zg==");
    expect(encode("fo")).toBe("Zm8=");
    expect(encode("foo")).toBe("Zm9v");
    expect(encode("foobar")).toBe("Zm9vYmFy");
  });

  it("agrees with Buffer across every byte value", () => {
    const all = Uint8Array.from({ length: 256 }, (_, index) => index);
    expect(encodeBase64(all)).toBe(Buffer.from(all).toString("base64"));
  });

  it("takes a clip far longer than one call's argument limit", () => {
    const long = new Uint8Array(1024 * 1024 + 1).map((_, index) => index % 251);
    expect(encodeBase64(long)).toBe(Buffer.from(long).toString("base64"));
  });
});

describe("checkMessageMedia", () => {
  it("passes strings, text parts and media on a user turn", () => {
    expect(() => {
      checkMessageMedia(
        [
          { role: "system", content: "s" },
          { role: "assistant", content: [{ type: "text", text: "a" }] },
          { role: "user", content: [{ type: "text", text: "u" }, image()] },
        ],
        BOTH,
      );
    }).not.toThrow();
  });

  it.each(["system", "assistant", "tool"] as const)("refuses media on a %s message", (role) => {
    let caught: unknown;
    try {
      checkMessageMedia([{ role, content: [image()] }], BOTH);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(UnsupportedContentError);
    expect((caught as UnsupportedContentError).mediaType).toBe("image/png");
  });

  it("refuses what the model does not declare", () => {
    expect(() => {
      checkMessageMedia([{ role: "user", content: [image()] }], { images: false, audio: true });
    }).toThrow(UnsupportedContentError);
  });

  it("leaves the size limits to the caller that owns the run", () => {
    const large = image(DEFAULT_MEDIA_LIMITS.maxPartBytes);
    expect(() => {
      checkMessageMedia([{ role: "user", content: [large] }], BOTH);
    }).not.toThrow();
  });
});
