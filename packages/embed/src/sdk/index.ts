/**
 * @truecanadianmaps/web — ESM SDK for bundlers.
 * Unlike the script-tag core, this bundle does not know where the API lives, so `apiUrl` is required
 * (e.g. https://api.truecanadianmaps.com or https://maps.example.com/api) and the worker is bundled
 * from maplibre-gl by the consumer's bundler.
 */
import { mount } from "../core/mount";
import type { CreateMapOptions, TcmMap } from "../core/types";
export type * from "../core/types";

export async function createMap(opts: CreateMapOptions & { apiUrl: string; workerUrl?: string }): Promise<TcmMap> {
  return mount(opts, { apiUrl: opts.apiUrl, workerUrl: opts.workerUrl ?? null });
}
