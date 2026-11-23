let snapLoadPromise = null;
let loadedScriptUrl = null;

export const loadMidtransSnapScript = (scriptUrl, clientKey) => {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Window unavailable"));
  }
  if (window.snap && loadedScriptUrl === scriptUrl) {
    return Promise.resolve(window.snap);
  }
  if (snapLoadPromise && loadedScriptUrl === scriptUrl) {
    return snapLoadPromise;
  }

  loadedScriptUrl = scriptUrl;
  snapLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-truekicks-snap="1"]');
    if (existing) existing.remove();

    const script = document.createElement("script");
    script.src = scriptUrl;
    script.async = true;
    script.setAttribute("data-client-key", clientKey || "");
    script.setAttribute("data-truekicks-snap", "1");

    script.onload = () => {
      if (window.snap) {
        resolve(window.snap);
      } else {
        reject(new Error("Midtrans Snap loaded but window.snap is missing."));
      }
    };
    script.onerror = () => {
      snapLoadPromise = null;
      reject(new Error("Failed to load Midtrans Snap.js"));
    };

    document.body.appendChild(script);
  });

  return snapLoadPromise;
};

export const openMidtransSnap = async ({
  token,
  clientKey,
  snapScriptUrl,
  redirectUrl,
  onSuccess,
  onPending,
  onError,
  onClose,
}) => {
  if (!token) {
    if (redirectUrl) {
      window.location.href = redirectUrl;
      return { opened: true, method: "redirect" };
    }
    throw new Error("Missing Midtrans Snap token.");
  }

  try {
    const snap = await loadMidtransSnapScript(snapScriptUrl, clientKey);
    snap.pay(token, {
      onSuccess: (result) => onSuccess?.(result),
      onPending: (result) => onPending?.(result),
      onError: (result) => onError?.(result),
      onClose: () => onClose?.(),
    });
    return { opened: true, method: "popup" };
  } catch (err) {
    if (redirectUrl) {
      window.location.href = redirectUrl;
      return { opened: true, method: "redirect" };
    }
    throw err;
  }
};
