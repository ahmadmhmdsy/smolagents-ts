/**
 * @smolagents-ts/models-gateway: a model reached through an OpenAI-compatible AI gateway, with
 * the gateway's routing and cost read from its response headers (decision 0040).
 *
 * The seam's own types are not re-exported here; they belong to @smolagents-ts/core.
 */
export { GatewayModel } from "./gateway-model.js";
export type { GatewayFetch, GatewayModelOptions, GatewayResponseContext } from "./gateway-model.js";
export { DEFAULT_GATEWAY_HEADER_PREFIXES, readGatewayHeaders } from "./headers.js";
export type { GatewayResponse } from "./headers.js";
export { GatewayModelListError, listGatewayModels } from "./list-models.js";
export type { ListGatewayModelsOptions } from "./list-models.js";
export { VERSION } from "./version.js";
