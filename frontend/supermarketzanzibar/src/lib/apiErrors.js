export function getApiErrorMessage(err, fallback = "Request failed.") {
  if (err?.code === "ECONNABORTED") {
    return "Please refresh to countinue";
  }
  if (!err?.response) {
    return "Unable to reach the server. Check your connection and try again.";
  }
  const data = err.response.data;
  if (typeof data === "string" && data.trim()) return data;
  if (typeof data?.detail === "string" && data.detail.trim()) return data.detail;
  return fallback;
}
