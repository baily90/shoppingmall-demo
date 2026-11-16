// 缺省图占位：内联 SVG data URI，不发额外网络请求，弱网/无图时秒显
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect width="400" height="400" fill="#f2f3f5"/><g stroke="#c7c9cf" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="120" y="130" width="160" height="120" rx="12"/><circle cx="172" cy="172" r="13" fill="#c7c9cf" stroke="none"/><path d="M140 230 L182 176 L206 200 L228 178 L260 230 Z" fill="#c7c9cf" stroke="none"/></g></svg>`;

export const PLACEHOLDER_IMG = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(SVG)}`;
