<script>
  import { toast as toastStore } from '$lib/stores/user.js';

  const typeStyles = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };

  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
  };
</script>

{#if $toastStore.show}
  <div class="fixed top-20 right-6 z-50 animate-[slideIn_0.3s_ease-out]">
    <div class="px-4 py-3 rounded-lg border shadow-lg flex items-center gap-2 {typeStyles[$toastStore.type] || typeStyles.info}">
      <span class="text-lg">{icons[$toastStore.type] || icons.info}</span>
      <span class="text-sm font-medium">{$toastStore.message}</span>
    </div>
  </div>
{/if}

<style>
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
</style>
