// Supabase 2.117 invokes `docker create -p host:container`. Explicit host IP
// also works on Docker Desktop versions that ignore the bridge's default IP.
export function bindLoopback(args, network, project) {
  if (!["create", "run"].includes(args[0])) return args;
  const output = [...args];
  for (let i = 1; i < output.length; i++) {
    if (/^(--publish=|-p.+)/.test(output[i]))
      throw new Error("Unexpected compact publish argument.");
    if (!["-p", "--publish"].includes(output[i])) continue;
    const name = output[output.indexOf("--name") + 1];
    const target = output[output.indexOf("--network") + 1];
    if (
      target !== network ||
      !name?.startsWith("supabase_") ||
      !name.endsWith(`_${project}`)
    )
      throw new Error(
        "Refusing a published port outside the selected Supabase project.",
      );
    const value = output[++i];
    if (!/^\d+:\d+(\/tcp|\/udp)?$/.test(value))
      throw new Error("Unexpected Supabase publish argument.");
    output[i] = `127.0.0.1:${value}`;
  }
  return output;
}
