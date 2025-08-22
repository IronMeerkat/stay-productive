export type ApiClientOptions = {
  baseUrl: string;
  getToken?: () => Promise<string | null>;
};

export class ApiClient {
  constructor(private readonly options: ApiClientOptions) {}

  private async headers(): Promise<Record<string, string>> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = await this.options.getToken?.();
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }

  async get<T>(path: string): Promise<T> {
    const res = await fetch(new URL(path, this.options.baseUrl), {
      method: 'GET',
      headers: await this.headers(),
    });
    if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
    return (await res.json()) as T;
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(new URL(path, this.options.baseUrl), {
      method: 'POST',
      headers: await this.headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
    return (await res.json()) as T;
  }
}
