(() => {
  if (window.__DREAM_UNITY_LOADER_STARTED__) return;
  window.__DREAM_UNITY_LOADER_STARTED__ = true;

  const loaderElement = document.currentScript;
  const loaderUrl = loaderElement?.src || new URL("./runtime/loader.js", document.baseURI).href;
  const manifestUrl = new URL("./chunks/manifest.json", loaderUrl);
  const progress = document.getElementById("boot-progress");
  const status = document.getElementById("boot-status");

  const update = (percent, message) => {
    if (progress) progress.style.width = `${percent}%`;
    if (status) status.textContent = message;
  };

  const fail = (error) => {
    window.__DREAM_UNITY_LOADER_ERROR__ = error instanceof Error ? error.message : String(error);
    console.error("Dream Unity runtime delivery failed:", error);
    window.dispatchEvent(new CustomEvent("dreamunity:loadererror", {
      detail: { message: window.__DREAM_UNITY_LOADER_ERROR__ }
    }));
    window.__DREAM_UNITY_REVEAL_STATIC__?.();
  };

  const load = async () => {
    update(14, "LOCATING UNITY ENGINE");
    const manifestResponse = await fetch(manifestUrl, { cache: "force-cache" });
    if (!manifestResponse.ok) throw new Error(`Runtime manifest returned ${manifestResponse.status}`);
    const manifest = await manifestResponse.json();
    if (!Array.isArray(manifest.chunks) || !manifest.chunks.length) throw new Error("Runtime manifest is empty");

    let loaded = 0;
    update(20, "STREAMING POSSIBILITY FIELD");
    const buffers = await Promise.all(manifest.chunks.map(async (chunk) => {
      const response = await fetch(new URL(chunk.file, manifestUrl), { cache: "force-cache" });
      if (!response.ok) throw new Error(`${chunk.file} returned ${response.status}`);
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength !== chunk.bytes) {
        throw new Error(`${chunk.file} was truncated (${buffer.byteLength}/${chunk.bytes} bytes)`);
      }
      loaded += 1;
      update(20 + Math.round((loaded / manifest.chunks.length) * 48), "STREAMING POSSIBILITY FIELD");
      return buffer;
    }));

    const totalBytes = buffers.reduce((total, buffer) => total + buffer.byteLength, 0);
    if (totalBytes !== manifest.totalBytes) throw new Error(`Runtime integrity mismatch (${totalBytes}/${manifest.totalBytes} bytes)`);

    update(72, "ASSEMBLING UNITY ENGINE");
    const runtimeBlob = new Blob(buffers, { type: "text/javascript" });
    const runtimeUrl = URL.createObjectURL(runtimeBlob);
    const runtimeScript = document.createElement("script");
    runtimeScript.src = runtimeUrl;
    runtimeScript.async = false;
    runtimeScript.onload = () => URL.revokeObjectURL(runtimeUrl);
    runtimeScript.onerror = () => {
      URL.revokeObjectURL(runtimeUrl);
      fail(new Error("The reconstructed runtime could not execute"));
    };
    document.head.append(runtimeScript);
  };

  load().catch(fail);
})();
