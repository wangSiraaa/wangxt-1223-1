<script>
  export let loading = false;
  export let emptyText = '暂无数据';
  export let error = null;
</script>

{#if loading}
  <div class="flex items-center justify-center py-16">
    <div class="flex items-center gap-3 text-gray-500">
      <svg class="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <span class="text-sm">加载中...</span>
    </div>
  </div>
{:else if error}
  <div class="flex items-center justify-center py-16">
    <div class="text-center">
      <div class="text-4xl mb-2">😔</div>
      <div class="text-sm text-gray-500">{error}</div>
    </div>
  </div>
{:else}
  <div class="flex items-center justify-center py-16">
    <div class="text-center">
      <div class="text-4xl mb-2">📭</div>
      <div class="text-sm text-gray-400">{emptyText}</div>
    </div>
  </div>
{/if}
