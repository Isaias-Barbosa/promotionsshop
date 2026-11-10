self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let message = {};
    try { message = event.data?.json() || {}; } catch {}
    const count = Number(message.count) || 1;
    await self.registration.showNotification('Novos cupons no Garimpo', {
      body: count === 1 ? 'Tem um novo cupom para conferir.' : 'Confira ' + count + ' novos cupons.',
      icon: '/push-icon.svg',
      tag: 'garimpo-cupons-' + String(message.lastEvent || 'novo'),
      renotify: false,
    });
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const target = new URL('/#descontos', self.location.origin).href;
    const windows = await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for (const client of windows) {
      if (new URL(client.url).origin !== self.location.origin) continue;
      try {
        const destination = await client.navigate(target);
        if (destination) return destination.focus();
      } catch {}
    }
    await self.clients.openWindow(target);
  })());
});
