export async function readJsonResponse<T = unknown>(response: Response, serviceName: string): Promise<T> {
  try {
    return await response.json() as T;
  } catch {
    throw new Error(`${serviceName} returned an unreadable response (HTTP ${response.status}).`);
  }
}
