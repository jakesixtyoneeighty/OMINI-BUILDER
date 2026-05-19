import { map } from 'nanostores';

export const chatStore = map({
  started: false,
  aborted: false,
  showChat: true,
  planMode: false,
  thinkMode: false, // /think — AI reasons deeper with visible thinking
});
