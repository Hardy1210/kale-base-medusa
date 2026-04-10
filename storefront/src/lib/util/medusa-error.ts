// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function medusaError(error: any): never {
  if (typeof error.status === "number") {
    // FetchError from @medusajs/js-sdk (Medusa v2 SDK uses fetch, not Axios)
    const message = error.message || error.statusText || "Request failed"
    throw new Error(message.charAt(0).toUpperCase() + message.slice(1))
  } else if (error.response) {
    // Axios-style error (legacy)
    const u = new URL(error.config.url, error.config.baseURL)
    console.error("Resource:", u.toString())
    console.error("Response data:", error.response.data)
    console.error("Status code:", error.response.status)
    console.error("Headers:", error.response.headers)

    const message = error.response.data.message || error.response.data
    throw new Error(message.charAt(0).toUpperCase() + message.slice(1) + ".")
  } else if (error.request) {
    throw new Error("No response received: " + error.request)
  } else {
    throw new Error("Error setting up the request: " + error.message)
  }
}
