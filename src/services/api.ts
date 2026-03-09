import axios from "axios";
import { Capacitor } from "@capacitor/core";
import { APP_API, API_TIMEOUT } from "../config/api.config";/*If error: please use api.config.example.ts*/

console.log("API Base URL:", APP_API);

const api = axios.create({
  baseURL: APP_API,
  timeout: API_TIMEOUT,
});

export default api;
export { APP_API };
