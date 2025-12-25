export default {
  async fetch(request, env) {
	const key = new URL(request.url).pathname.slice(1);
    const value = await env.SERVERINFO.get(key);

    if (value) {
      return new Response(value, {
        headers: { "Content-Type": "application/json" },
      });
    }

    return fetch(
      "https://yostar-serverinfo.bluearchiveyostar.com/" + key
    );
  },
};
