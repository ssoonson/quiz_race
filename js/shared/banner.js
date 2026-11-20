// 화면 가운데 큰 알림(선두 교체, 골인 등)과 카운트다운 숫자
import { escapeHTML } from '../core/dom.js';

export function createBanner(el) {
  el.classList.add('announcer');
  el.innerHTML = '<div class="countdown"></div><div class="banner"></div>';
  const count = el.querySelector('.countdown');
  const banner = el.querySelector('.banner');
  let t1, t2, busyUntil = 0, busyLevel = 0;

  return {
    /** title: 작은 윗줄, text: 큰 글씨, level이 높은 알림은 낮은 알림에 덮이지 않음 */
    show(title, text, { kind = '', ms = 1700, level = 1 } = {}) {
      const nowMs = performance.now();
      if (nowMs < busyUntil && level < busyLevel) return;
      busyUntil = nowMs + ms;
      busyLevel = level;
      banner.innerHTML = `${title ? `<small>${escapeHTML(title)}</small>` : ''}${escapeHTML(text)}`;
      banner.className = `banner show ${kind}`;
      void banner.offsetWidth;
      banner.classList.add('pop');
      clearTimeout(t1);
      t1 = setTimeout(() => { banner.className = 'banner'; }, ms);
    },
    count(text) {
      count.textContent = text;
      count.className = 'countdown show';
      void count.offsetWidth;
      count.classList.add('pop');
      clearTimeout(t2);
      t2 = setTimeout(() => { count.className = 'countdown'; }, 900);
    },
    clear() {
      banner.className = 'banner';
      count.className = 'countdown';
      busyUntil = 0;
    },
  };
}
