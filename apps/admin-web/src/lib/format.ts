export function formatCount(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return '暂无';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatDateTimeRelative(value: string | null | undefined): string {
  if (!value) {
    return '暂无';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const diffMinutes = Math.round((date.getTime() - Date.now()) / 60_000);
  if (Math.abs(diffMinutes) < 1) {
    return '刚刚';
  }
  if (Math.abs(diffMinutes) < 60) {
    return `${Math.abs(diffMinutes)} 分钟${diffMinutes >= 0 ? '后' : '前'}`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return `${Math.abs(diffHours)} 小时${diffHours >= 0 ? '后' : '前'}`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${Math.abs(diffDays)} 天${diffDays >= 0 ? '后' : '前'}`;
}

