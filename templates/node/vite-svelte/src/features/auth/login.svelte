<script lang="ts">
  import { goto } from "$app/navigation";
  import { ROUTES } from "@/configs/routes";
  import { signIn } from "@/stores/session.svelte";

  let name = $state("");
  let error = $state("");

  function handleSubmit(event: SubmitEvent): void {
    event.preventDefault();
    const value = name.trim();
    if (!value) {
      error = "Enter a display name.";
      return;
    }
    signIn(value);
    void goto(ROUTES.overview);
  }
</script>

<div class="auth-card">
  <h1>Sign in</h1>
  <p>Demo only — no backend required.</p>

  <form onsubmit={handleSubmit}>
    <label for="display-name">Display name</label>
    <input id="display-name" bind:value={name} autocomplete="username" />
    {#if error}
      <p class="form-error">{error}</p>
    {/if}
    <button type="submit">Continue</button>
  </form>

  <p class="auth-links">
    <a href={ROUTES.signUp}>Create account</a>
    <span>·</span>
    <a href={ROUTES.forgotPassword}>Forgot password?</a>
  </p>
</div>
