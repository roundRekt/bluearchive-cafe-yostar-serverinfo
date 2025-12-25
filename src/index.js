export default {
  async fetch(request, env, ctx) {
    const key = new URL(request.url).pathname.slice(1);

    // KV 中有，则从 KV 中读取
    if (key && !key.includes("/") && key.startsWith("r") && key.endsWith(".json")) {
      let value = await env.SERVERINFO.get(key);
      if (value) {
        return new Response(value, {
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // KV 中没有，则从上游拉取
    const upstream = await fetch(
      "https://yostar-serverinfo.bluearchiveyostar.com/" + key
    );

    // 上游返回错误或不需要缓存，则直接返回上游响应
    if (!upstream.ok || key.includes("/") || !key.startsWith("r") || !key.endsWith(".json")) {
      return upstream;
    }

    // 解析上游响应为 JSON 对象
    let serverinfo;
    try {
      serverinfo = await upstream.json();
    } catch {
      return upstream;
    }

    // 替换 JSON 里的 URL
    for (const connectionGroup of serverinfo.ConnectionGroups || []) {
      if (connectionGroup.ManagementDataUrl) {
        connectionGroup.ManagementDataUrl = connectionGroup.ManagementDataUrl.replace(
          "prod-noticeindex.bluearchiveyostar.com",
          "prod-noticeindex.bluearchive.cafe"
        );
      }
      for (const overrideGroup of connectionGroup.OverrideConnectionGroups || []) {
        if (overrideGroup.Name !== "1.0" && overrideGroup.AddressablesCatalogUrlRoot) {
          overrideGroup.AddressablesCatalogUrlRoot =
            overrideGroup.AddressablesCatalogUrlRoot.replace(
              "prod-clientpatch.bluearchiveyostar.com",
              "prod-noticeindex.bluearchive.cafe"
            );
        }
      }
    }

    // 转换修改后的 JSON 为字符串
    const value = JSON.stringify(serverinfo, null, 2);

    // 更新 latest 记录
    ctx.waitUntil((async () => {
      const latest = await env.SERVERINFO.get("latest");
      if (!latest || key > latest) {
        env.SERVERINFO.put("latest", key);
      }
    })());

    // 缓存修改后的服务器信息到 KV
    ctx.waitUntil(env.SERVERINFO.put(key, value));

    // 返回修改后的服务器信息
    return new Response(value, {
      headers: { "Content-Type": "application/json" },
    });
  },

  async scheduled(controller, env, ctx) {
    try {
      const latest = await env.SERVERINFO.get("latest");
      if (!latest) {
        console.log("获取文件名错误");
        return;
      }

      const upstream = await fetch(
        "https://yostar-serverinfo.bluearchiveyostar.com/" + latest
      );
      if (!upstream.ok) {
        console.log("从上游拉取错误", upstream.status);
        return;
      }

      let serverinfo;
      try {
        serverinfo = await upstream.json();
      } catch (e) {
        console.log("解析为 JSON 错误", e);
        return;
      }

      for (const connectionGroup of serverinfo.ConnectionGroups || []) {
        if (connectionGroup.ManagementDataUrl) {
          connectionGroup.ManagementDataUrl = connectionGroup.ManagementDataUrl.replace(
            "prod-noticeindex.bluearchiveyostar.com",
            "prod-noticeindex.bluearchive.cafe"
          );
        }
        for (const overrideGroup of connectionGroup.OverrideConnectionGroups || []) {
          if (overrideGroup.Name !== "1.0" && overrideGroup.AddressablesCatalogUrlRoot) {
            overrideGroup.AddressablesCatalogUrlRoot =
              overrideGroup.AddressablesCatalogUrlRoot.replace(
                "prod-clientpatch.bluearchiveyostar.com",
                "prod-noticeindex.bluearchive.cafe"
              );
          }
        }
      }

      const value = JSON.stringify(serverinfo, null, 2);

      await env.SERVERINFO.put(latest, value);
      
      console.log(`更新服务器信息成功：${latest}`);
    } catch (err) {
      console.error("更新服务器信息失败：", err);
    }
  },
};