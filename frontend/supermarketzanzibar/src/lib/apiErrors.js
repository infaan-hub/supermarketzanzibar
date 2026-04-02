export function getApiErrorMessage(error, fallbackMessage) {
  if (error?.code === "ECONNABORTED") {
    return "Please refresh to countinue";
  }

  const detail = error?.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }

  if (!error?.response) {
    return "Unable to reach the server. Check your API URL or backend connection and try again.";
  }

  return fallbackMessage;
}
