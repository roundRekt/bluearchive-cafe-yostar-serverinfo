export default {
  async fetch(request, env, ctx) {
    const key = new URL(request.url).pathname.slice(1);

    if (key && !key.includes("/") && key.startsWith("r") && key.endsWith(".json")) {
      const value = await env.SERVERINFO.get(key);
      if (value) {
        return new Response(value, {
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    const upstream = await fetch(
      "https://yostar-serverinfo.bluearchiveyostar.com/" + key
    );

    if (!upstream.ok || key.includes("/") || !key.startsWith("r") || !key.endsWith(".json")) {
      return upstream;
    }

    ctx.waitUntil((async () => {
      const status = JSON.parse(await env.STATUS.get("Resource.Official") || '{"version":"","time":""}');
      const version = key.replace(/\.json$/, "");
      const time = new Date().toLocaleString("sv-SE", {
        timeZone: "Asia/Shanghai"
      });

      if (version > status.version) {
        await env.STATUS.put("Resource.Official", JSON.stringify({ version, time }));
      }
    })());

    return upstream;
  },
};
