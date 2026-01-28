import axios from "axios";
import { Capacitor } from "@capacitor/core";
import { LOCAL_IP } from "../config/api.config";
import { API_TIMEOUT } from "../config/api.config";

const isNative = Capacitor.isNativePlatform();

const API_BASE_URL = isNative
  ? `http://${LOCAL_IP}/isymphony_api/public/api`
  : "http://localhost/isymphony_api/public/api";

console.log("API Base URL:", API_BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
});

export default api;
export { API_BASE_URL };
