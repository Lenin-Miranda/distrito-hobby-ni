import { getPublicApiBaseUrl } from "@/config/public";
import { fetchHealth } from "./health";

export function fetchBrowserHealth() {
  return fetchHealth(getPublicApiBaseUrl());
}
