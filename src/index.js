export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const key = url.pathname.slice(1);

    if (!key) {
      return fetch("https://yostar-serverinfo.bluearchiveyostar.com/");
    }

    const cached = await env.SERVERINFO.get(key);
    if (cached) {
      return new Response(cached, {
        headers: { "Content-Type": "application/json" },
      });
    }

    const upstreamUrl =
      "https://yostar-serverinfo.bluearchiveyostar.com/" + key;

    const resp = await fetch(upstreamUrl);
    if (!resp.ok) {
      return resp;
    }

    const shouldCache =
      !key.includes("/") &&
      key.startsWith("r") &&
      key.endsWith(".json");

    if (!shouldCache) {
      return resp;
    }

    let data;
    try {
      data = await resp.json();
    } catch {
      return resp;
    }

    if (Array.isArray(data.ConnectionGroups)) {
      for (const group of data.ConnectionGroups) {
        if (group.ManagementDataUrl) {
          group.ManagementDataUrl = group.ManagementDataUrl.replace(
            "prod-noticeindex.bluearchiveyostar.com",
            "prod-noticeindex.bluearchive.cafe"
          );
        }

        for (const override of group.OverrideConnectionGroups || []) {
          if (
            override.Name !== "1.0" &&
            override.AddressablesCatalogUrlRoot
          ) {
            override.AddressablesCatalogUrlRoot =
              override.AddressablesCatalogUrlRoot.replace(
                "prod-clientpatch.bluearchiveyostar.com",
                "prod-noticeindex.bluearchive.cafe"
              );
          }
        }
      }
    }

    const jsonText = JSON.stringify(data, null, 2);

    await env.SERVERINFO.put(key, jsonText);

    return new Response(jsonText, {
      headers: { "Content-Type": "application/json" },
    });
  },
};