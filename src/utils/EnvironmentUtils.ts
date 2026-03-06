export function isRunningInGeminiCanvas(): boolean {
  // Canvas injects several scripts which allow using the free tier of Gemini and Firebase APIs without API keys.
  return (
    typeof (window as {firebaseAuthBridgeScriptLoaded?: boolean})
      .firebaseAuthBridgeScriptLoaded !== 'undefined'
  );
}
