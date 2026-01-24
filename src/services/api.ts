import axios from "axios";
import { Capacitor } from "@capacitor/core";

const isNative = Capacitor.isNativePlatform();

// (cmd → ipconfig → IPv4 Address)
const LOCAL_IP = "192.168.160.19";
////const LOCAL_IP = "10.1.10.33";

const API_BASE_URL = isNative
  ? `http://${LOCAL_IP}/isymphony_api/public/api`
  : "http://localhost/isymphony_api/public/api";

console.log("API Base URL:", API_BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

export default api;
export { API_BASE_URL };
