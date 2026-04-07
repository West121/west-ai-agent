import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { LeaveMessagePage } from '@/routes/leave-message';
import * as customerApi from '@/lib/customer-h5-api';

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-router')>('@tanstack/react-router');
  return {
    ...actual,
    Link: ({
      children,
      to,
      ...props
    }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  };
});

describe('LeaveMessagePage', () => {
  it('submits trimmed leave-message payload and shows success summary', async () => {
    const submitLeaveMessage = vi.spyOn(customerApi, 'submitLeaveMessage').mockResolvedValue(undefined);

    render(<LeaveMessagePage />);

    await userEvent.clear(screen.getByLabelText('visitor_name'));
    await userEvent.type(screen.getByLabelText('visitor_name'), ' 张三 ');
    await userEvent.clear(screen.getByLabelText('content'));
    await userEvent.type(screen.getByLabelText('content'), ' 需要人工回电 ');
    await userEvent.click(screen.getByRole('button', { name: '提交留言' }));

    await waitFor(() => {
      expect(submitLeaveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          visitor_name: '张三',
          content: '需要人工回电',
        }),
      );
    });

    expect(await screen.findByText('后端未返回内容，留言已提交。')).toBeInTheDocument();
  });
});
