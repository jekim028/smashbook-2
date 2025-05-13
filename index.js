import { registerRootComponent } from "expo";
import "expo-router/entry";

// This redirects to the expo-router entry point
registerRootComponent(require("expo-router").default); 