export function isStringRecord(obj: unknown): obj is Record<string, unknown> {
    return typeof obj === 'object' && obj !== null && !Array.isArray(obj) && obj.constructor === Object;
}

export function tryParseJson(json: string): unknown {
    try {
        return JSON.parse(json);
    } catch {
        // noop
    }
}

export function tryDecodeText(data: BufferSource): string | undefined {
    try {
        return new TextDecoder().decode(data);
    } catch {
        // noop
    }
}

export function tryParseUrl(value: string): URL | undefined {
    try {
        return new URL(value);
    } catch {
        // noop
    }
}

export function isValidIso8601(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value);
}

export function isValidUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function isValidUrl(value: string): boolean {
    return tryParseUrl(value) !== undefined;
}
