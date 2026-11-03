import { createApp } from "vue";
import App from "./app/index.vue";
import router from "./app/router";
import "./styles/globals.css";

const rootElement = document.getElementById("app");

if (!rootElement) {
  throw new Error('Root element "#app" not found.');
}

createApp(App).use(router).mount(rootElement);
