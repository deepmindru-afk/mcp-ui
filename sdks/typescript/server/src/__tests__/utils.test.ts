import { describe, it, expect, vi } from 'vitest';
import { getAdditionalResourceProps, utf8ToBase64, wrapHtmlWithAdapters, getAdapterMimeType } from '../utils.js';
import { UI_METADATA_PREFIX } from '../types.js';

describe('getAdditionalResourceProps', () => {
  it('should return the additional resource props', () => {
    const uiMetadata = {
      'preferred-frame-size': ['100px', '100px'] as [string, string],
      'initial-render-data': { test: 'test' },
    };
    const additionalResourceProps = getAdditionalResourceProps({ uiMetadata });
    expect(additionalResourceProps).toEqual({
      _meta: {
        [`${UI_METADATA_PREFIX}preferred-frame-size`]: ['100px', '100px'],
        [`${UI_METADATA_PREFIX}initial-render-data`]: { test: 'test' },
      },
    });
  });

  it('should return the additional resource props with user defined _meta', () => {
    const uiMetadata = {
      'preferred-frame-size': ['100px', '100px'] as [string, string],
      'initial-render-data': { test: 'test' },
    };
    const additionalResourceProps = getAdditionalResourceProps({
      uiMetadata,
      resourceProps: {
        annotations: { audience: 'user' },
        _meta: { foo: 'bar', [`${UI_METADATA_PREFIX}preferred-frame-size`]: ['200px', '200px'] },
      },
    });
    expect(additionalResourceProps).toEqual({
      _meta: {
        [`${UI_METADATA_PREFIX}initial-render-data`]: { test: 'test' },
        foo: 'bar',
        [`${UI_METADATA_PREFIX}preferred-frame-size`]: ['200px', '200px'],
      },
      annotations: { audience: 'user' },
    });
  });

  it('should return an empty object if no uiMetadata or metadata is provided', () => {
    const additionalResourceProps = getAdditionalResourceProps({});
    expect(additionalResourceProps).toEqual({});
  });

  it('should respect order of overriding metadata', () => {
    const additionalResourceProps = getAdditionalResourceProps({
      uiMetadata: { 'preferred-frame-size': ['100px', '100px'] as [string, string] },
      metadata: { [`${UI_METADATA_PREFIX}preferred-frame-size`]: ['200px', '200px'], foo: 'bar' },
      resourceProps: { annotations: { audience: 'user' }, _meta: { foo: 'baz' } },
    });
    expect(additionalResourceProps).toEqual({
      _meta: {
        [`${UI_METADATA_PREFIX}preferred-frame-size`]: ['200px', '200px'],
        foo: 'baz',
      },
      annotations: { audience: 'user' },
    });
  });
});

describe('utf8ToBase64', () => {
  it('should correctly encode a simple ASCII string', () => {
    const str = 'hello world';
    const expected = 'aGVsbG8gd29ybGQ=';
    expect(utf8ToBase64(str)).toBe(expected);
  });

  it('should correctly encode a string with UTF-8 characters', () => {
    const str = '你好,世界';
    const expected = '5L2g5aW9LOS4lueVjA==';
    expect(utf8ToBase64(str)).toBe(expected);
  });

  it('should correctly encode an empty string', () => {
    const str = '';
    const expected = '';
    expect(utf8ToBase64(str)).toBe(expected);
  });

  it('should correctly encode a string with various special characters', () => {
    const str = '`~!@#$%^&*()_+-=[]{}\\|;\':",./<>?';
    const expected = 'YH4hQCMkJV4mKigpXystPVtde31cfDsnOiIsLi88Pj8=';
    expect(utf8ToBase64(str)).toBe(expected);
  });

  it('should use TextEncoder and btoa when Buffer is not available', () => {
    const str = 'hello world';
    const expected = 'aGVsbG8gd29ybGQ=';

    const bufferBackup = global.Buffer;
    // @ts-expect-error - simulating Buffer not being available
    delete global.Buffer;

    expect(utf8ToBase64(str)).toBe(expected);

    global.Buffer = bufferBackup;
  });

  it('should use fallback btoa when Buffer and TextEncoder are not available', () => {
    const str = 'hello world';
    const expected = 'aGVsbG8gd29ybGQ=';

    const bufferBackup = global.Buffer;
    const textEncoderBackup = global.TextEncoder;

    // @ts-expect-error - simulating Buffer not being available
    delete global.Buffer;
    // @ts-expect-error - simulating TextEncoder not being available
    delete global.TextEncoder;

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(utf8ToBase64(str)).toBe(expected);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'MCP-UI SDK: Buffer API and TextEncoder/btoa not available. Base64 encoding might not be UTF-8 safe.',
    );

    consoleWarnSpy.mockRestore();
    global.Buffer = bufferBackup;
    global.TextEncoder = textEncoderBackup;
  });

  it('should throw an error if all encoding methods fail', () => {
    const str = 'hello world';

    const bufferBackup = global.Buffer;
    const textEncoderBackup = global.TextEncoder;
    const btoaBackup = global.btoa;

    // @ts-expect-error - simulating Buffer not being available
    delete global.Buffer;
    // @ts-expect-error - simulating TextEncoder not being available
    delete global.TextEncoder;
    // @ts-expect-error - simulating btoa not being available
    delete global.btoa;

    expect(() => utf8ToBase64(str)).toThrow(
      'MCP-UI SDK: Suitable UTF-8 to Base64 encoding method not found, and fallback btoa failed.',
    );

    global.Buffer = bufferBackup;
    global.TextEncoder = textEncoderBackup;
    global.btoa = btoaBackup;
  });
});

describe('getAdapterMimeType', () => {
  it('should return undefined when no adapters are provided', () => {
    const result = getAdapterMimeType();
    expect(result).toBeUndefined();
  });

  it('should return undefined when adapters config is empty', () => {
    const result = getAdapterMimeType({});
    expect(result).toBeUndefined();
  });

  it('should return default mime type when appsSdk adapter is enabled', () => {
    const result = getAdapterMimeType({
      appsSdk: { enabled: true },
    });
    expect(result).toBe('text/html+skybridge');
  });

  it('should use custom mimeType from appsSdk config when provided', () => {
    const result = getAdapterMimeType({
      appsSdk: { enabled: true, mimeType: 'text/html+custom' },
    });
    expect(result).toBe('text/html+custom');
  });

  it('should return undefined when appsSdk is disabled', () => {
    const result = getAdapterMimeType({
      appsSdk: { enabled: false },
    });
    expect(result).toBeUndefined();
  });
});

describe('wrapHtmlWithAdapters', () => {
  it('should return original HTML when no adapters are provided', () => {
    const htmlContent = '<html><body>Test</body></html>';
    const result = wrapHtmlWithAdapters(htmlContent);
    expect(result).toBe(htmlContent);
  });

  it('should return original HTML when adapters config is empty', () => {
    const htmlContent = '<html><body>Test</body></html>';
    const result = wrapHtmlWithAdapters(htmlContent, {});
    expect(result).toBe(htmlContent);
  });

  it('should inject adapter script when appsSdk adapter is enabled', () => {
    const htmlContent = '<html><head></head><body>Test</body></html>';
    const result = wrapHtmlWithAdapters(htmlContent, {
      appsSdk: { enabled: true },
    });
    expect(result).toContain('<script>');
    expect(result).toContain('MCP_APPSSDK_ADAPTER');
  });

  it('should inject adapter script with custom mimeType config', () => {
    const htmlContent = '<html><head></head><body>Test</body></html>';
    const result = wrapHtmlWithAdapters(htmlContent, {
      appsSdk: { enabled: true, mimeType: 'text/html+custom' },
    });
    expect(result).toContain('<script>');
  });

  it('should inject adapter script into existing <head> tag', () => {
    const htmlContent = '<html><head><title>Test</title></head><body>Test</body></html>';
    const result = wrapHtmlWithAdapters(htmlContent, {
      appsSdk: { enabled: true },
    });
    expect(result).toContain('<head>\n<script>');
    expect(result).toContain('<title>Test</title>');
  });

  it('should create <head> tag if <html> exists but no <head>', () => {
    const htmlContent = '<html><body>Test</body></html>';
    const result = wrapHtmlWithAdapters(htmlContent, {
      appsSdk: { enabled: true },
    });
    expect(result).toContain('<html>\n<head>\n<script>');
    expect(result).toContain('</head>');
  });

  it('should prepend script when no <html> or <head> tags exist', () => {
    const htmlContent = '<div>Test</div>';
    const result = wrapHtmlWithAdapters(htmlContent, {
      appsSdk: { enabled: true },
    });
    expect(result).toMatch(/^<script>/);
    expect(result).toContain('<div>Test</div>');
  });

  it('should return original HTML when appsSdk is disabled', () => {
    const htmlContent = '<html><body>Test</body></html>';
    const result = wrapHtmlWithAdapters(htmlContent, {
      appsSdk: { enabled: false },
    });
    expect(result).toBe(htmlContent);
  });
});
