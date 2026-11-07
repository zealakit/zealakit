<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { ROUTES } from "@/configs/routes";
  import { session, signOut } from "@/stores/session.svelte";

  let { children } = $props();

  const navItems = [
    { label: "Overview", href: ROUTES.overview },
    { label: "Feature A", href: ROUTES.featureA },
  ] as const;

  function handleSignOut(): void {
    signOut();
    void goto(ROUTES.login);
  }
</script>

<div class="console">
  <aside class="console__sidebar">
    <a class="console__brand" href={ROUTES.overview}>Zealakit</a>
    <nav class="console__nav">
      {#each navItems as item (item.href)}
        <a
          class="console__nav-link"
          class:console__nav-link--active={page.url.pathname === item.href}
          href={item.href}
        >
          {item.label}
        </a>
      {/each}
    </nav>
  </aside>

  <div class="console__content">
    <header class="console__header">
      {#if session.user}
        <span>Signed in as {session.user.name}</span>
        <button type="button" onclick={handleSignOut}>Sign out</button>
      {:else}
        <span>Guest</span>
        <a class="button-link" href={ROUTES.login}>Sign in</a>
      {/if}
    </header>

    <main class="console__main">
      {@render children()}
    </main>
  </div>
</div>
