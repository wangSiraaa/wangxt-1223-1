<script>
  import '../app.css';
  import { page } from '$app/stores';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import Header from '$lib/components/Header.svelte';
  import Toast from '$lib/components/Toast.svelte';
  import { user } from '$lib/stores/user.js';
</script>

<svelte:head>
  <title>市政扫雪融冰调度系统</title>
</svelte:head>

<Toast />

{#if $page.url.pathname === '/login'}
  <div class="min-h-screen bg-gradient-to-br from-snow-50 to-primary-100">
    <slot />
  </div>
{:else}
  <div class="min-h-screen bg-gray-50 flex">
    <Sidebar />
    <div class="flex-1 flex flex-col min-w-0">
      <Header />
      <main class="flex-1 p-6 overflow-auto">
        <slot />
      </main>
    </div>
  </div>
{/if}
