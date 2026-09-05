(() => {
  if (window.__DREAM_UNITY_LOADER_STARTED__) return;
  window.__DREAM_UNITY_LOADER_STARTED__ = true;

  const loaderElement = document.currentScript;
  const loaderUrl = new URL(loaderElement?.src || "./runtime/loader.js", document.baseURI);
  const deliveryRevision = loaderUrl.searchParams.get("v") || "unversioned";
  const manifestUrl = new URL("./chunks/manifest.json", loaderUrl);
  manifestUrl.searchParams.set("v", deliveryRevision);
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

  const fetchManifest = async () => {
    const response = await fetch(manifestUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`Runtime manifest returned ${response.status}`);
    const manifest = await response.json();
    if (!Array.isArray(manifest.chunks) || !manifest.chunks.length) throw new Error("Runtime manifest is empty");
    if (!/^[a-f0-9]{64}$/.test(manifest.revision || "")) throw new Error("Runtime manifest has no valid revision");
    return manifest;
  };

  const fetchChunks = async (manifest, cache) => {
    let loaded = 0;
    return Promise.all(manifest.chunks.map(async (chunk) => {
      const chunkUrl = new URL(chunk.file, manifestUrl);
      chunkUrl.searchParams.set("v", manifest.revision);
      const response = await fetch(chunkUrl, { cache });
      if (!response.ok) throw new Error(`${chunk.file} returned ${response.status}`);
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength !== chunk.bytes) {
        throw new Error(`${chunk.file} was truncated (${buffer.byteLength}/${chunk.bytes} bytes)`);
      }
      loaded += 1;
      update(20 + Math.round((loaded / manifest.chunks.length) * 48), "STREAMING POSSIBILITY FIELD");
      return buffer;
    }));
  };

  const assembleAndVerify = async (manifest, buffers) => {
    const totalBytes = buffers.reduce((total, buffer) => total + buffer.byteLength, 0);
    if (totalBytes !== manifest.totalBytes) throw new Error(`Runtime integrity mismatch (${totalBytes}/${manifest.totalBytes} bytes)`);

    const runtimeBytes = new Uint8Array(totalBytes);
    let offset = 0;
    buffers.forEach((buffer) => {
      runtimeBytes.set(new Uint8Array(buffer), offset);
      offset += buffer.byteLength;
    });

    if (globalThis.crypto?.subtle) {
      const digest = await globalThis.crypto.subtle.digest("SHA-256", runtimeBytes);
      const revision = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
      if (revision !== manifest.revision) throw new Error("Runtime content revision does not match its manifest");
    }

    return runtimeBytes;
  };

  const loadDomainNavigation = () => {
    if (window.__DREAM_UNITY_DOMAIN_NAV_LOADING__) return;
    window.__DREAM_UNITY_DOMAIN_NAV_LOADING__ = true;
    const navigationScript = document.createElement("script");
    const navigationUrl = new URL("../portal-subnav.js", loaderUrl);
    navigationUrl.searchParams.set("v", deliveryRevision);
    navigationScript.src = navigationUrl.href;
    navigationScript.async = false;
    navigationScript.onerror = () => console.error("Dream Unity domain navigation could not load");
    document.head.append(navigationScript);
  };

  const load = async () => {
    update(14, "LOCATING UNITY ENGINE");
    const manifest = await fetchManifest();
    window.__DREAM_UNITY_RUNTIME_REVISION__ = manifest.revision;
    update(20, "STREAMING POSSIBILITY FIELD");
    let runtimeBytes;
    try {
      runtimeBytes = await assembleAndVerify(manifest, await fetchChunks(manifest, "force-cache"));
    } catch (cachedDeliveryError) {
      console.warn("Dream Unity discarded a stale runtime delivery and is refreshing it.", cachedDeliveryError);
      update(22, "REFRESHING UNITY ENGINE");
      runtimeBytes = await assembleAndVerify(manifest, await fetchChunks(manifest, "reload"));
    }

    update(72, "ASSEMBLING UNITY ENGINE");
    const runtimeBlob = new Blob([runtimeBytes], { type: "text/javascript" });
    const runtimeUrl = URL.createObjectURL(runtimeBlob);
    const runtimeScript = document.createElement("script");
    runtimeScript.src = runtimeUrl;
    runtimeScript.async = false;
    runtimeScript.onload = () => {
      URL.revokeObjectURL(runtimeUrl);
      loadDomainNavigation();
    };
    runtimeScript.onerror = () => {
      URL.revokeObjectURL(runtimeUrl);
      fail(new Error("The reconstructed runtime could not execute"));
    };
    document.head.append(runtimeScript);
  };

  load().catch(fail);
})();
