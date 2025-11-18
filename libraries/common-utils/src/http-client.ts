import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

export interface HttpClientConfig {
  baseURL?: string;
  timeout?: number;
  headers?: Record<string, string>;
  retries?: number;
}

/**
 * HTTP client wrapper with retry logic
 */
export class HttpClient {
  private client: AxiosInstance;
  private retries: number;

  constructor(config: HttpClientConfig = {}) {
    this.retries = config.retries || 3;

    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        console.log(`HTTP Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('HTTP Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        console.log(`HTTP Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error('HTTP Response Error:', error.message);
        return Promise.reject(error);
      }
    );
  }

  /**
   * GET request
   */
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.request<T>({ ...config, method: 'GET', url });
    return response.data;
  }

  /**
   * POST request
   */
  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.request<T>({ ...config, method: 'POST', url, data });
    return response.data;
  }

  /**
   * PUT request
   */
  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.request<T>({ ...config, method: 'PUT', url, data });
    return response.data;
  }

  /**
   * DELETE request
   */
  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.request<T>({ ...config, method: 'DELETE', url });
    return response.data;
  }

  /**
   * Generic request with retry logic
   */
  private async request<T = any>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    let lastError: any;

    for (let attempt = 1; attempt <= this.retries; attempt++) {
      try {
        return await this.client.request<T>(config);
      } catch (error: any) {
        lastError = error;

        // Don't retry on 4xx errors
        if (error.response && error.response.status >= 400 && error.response.status < 500) {
          throw error;
        }

        // Retry on 5xx or network errors
        if (attempt < this.retries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.log(`Retrying request (attempt ${attempt + 1}/${this.retries}) after ${delay}ms`);
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
