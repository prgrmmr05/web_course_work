$(function () {
  function getMaxQty(stock) {
    const stockNum = Number(stock || 0);
    return Math.max(1, Math.min(99, stockNum > 0 ? stockNum : 99));
  }

  function clampQty(value, stock) {
    let qty = Number(value);
    if (!Number.isFinite(qty)) qty = 1;
    return Math.max(1, Math.min(getMaxQty(stock), Math.round(qty)));
  }

  function formatCurrency(value) {
    const amount = Number(value || 0);
    return `${amount.toLocaleString('ru-RU')} ₽`;
  }

  function updateCartActionState($action, quantity) {
    const $label = $action.find('.cart-label');
    const $input = $action.find('.qty-input');
    const qty = Number(quantity || 0);
    const max = getMaxQty($action.data('stock'));

    $input.attr('max', max);

    if (qty > 0) {
      $action.addClass('is-in-cart');
      $label.text(`В корзине ${qty} шт.`);
      $input.val(qty);
    } else {
      $action.removeClass('is-in-cart');
      $action.removeClass('open');
      $label.text('Добавить в корзину');
      $input.val(1);
    }
  }

  function requestCartUpdate(productId, quantity, onDone) {
    $.ajax({
      url: '/api/cart/items',
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({ product_id: productId, quantity })
    })
      .done(function (response) {
        if (response.ok && typeof onDone === 'function') {
          onDone(response);
        }
      })
      .fail(function (xhr) {
        alert(xhr.responseJSON?.message || 'Не удалось обновить корзину');
      });
  }

  function updateCartSummary(pricing) {
    if (!pricing) return;

    $('#cart-subtotal').text(formatCurrency(pricing.subtotal || 0));
    $('#cart-discount').text(formatCurrency(pricing.discountTotal || 0));
    $('#cart-total').text(formatCurrency(pricing.total || 0));
    renderPromoCodes(pricing.promoCodes || []);

    $('.cart-item').each(function () {
      const $item = $(this);
      const productId = Number($item.data('product-id'));
      const found = (pricing.cartItems || []).find((x) => Number(x.product_id) === productId);
      if (found) {
        $item.find('.cart-line-total').text(formatCurrency(found.line_total || 0));
        $item.find('.cart-qty').val(clampQty(found.quantity, found.stock_quantity));
      }
    });
  }

  function renderPromoCodes(codes) {
    const $list = $('#cart-promo-list');
    if (!$list.length) return;

    const safeCodes = Array.isArray(codes) ? codes : [];
    if (!safeCodes.length) {
      $list.html('');
      return;
    }

    const html = safeCodes.map((code) => (
      `<div class="promo-chip" data-code="${code}">
        <span>${code}</span>
        <button type="button" class="promo-chip-remove" data-code="${code}" aria-label="Удалить промокод ${code}">&times;</button>
      </div>`
    )).join('');
    $list.html(html);
  }

  let promoMessageTimer = null;
  function setPromoMessage(text, type) {
    const $message = $('#cart-promo-message');
    if (!$message.length) return;

    $message.removeClass('is-error is-success');
    if (type === 'error') $message.addClass('is-error');
    if (type === 'success') $message.addClass('is-success');

    $message.text(text || '');
    if (!text) {
      $message.hide();
      return;
    }
    $message.show();

    if (promoMessageTimer) clearTimeout(promoMessageTimer);
    promoMessageTimer = setTimeout(function () {
      $message.fadeOut(200);
    }, 3000);
  }

  function triggerCartItemUpdate($card, quantity) {
    const productId = Number($card.data('product-id'));
    if (!productId) return;

    requestCartUpdate(productId, quantity, function (response) {
      if (response.data && response.data.pricing) {
        updateCartSummary(response.data.pricing);
      }
    });
  }

  $(document).on('mouseenter', '.cart-action.is-in-cart .add-to-cart', function () {
    const $action = $(this).closest('.cart-action');
    $action.addClass('open');
  });

  $(document).on('mouseleave', '.cart-action', function () {
    $(this).removeClass('open');
  });

  $(document).on('click', '.add-to-cart', function () {
    const $action = $(this).closest('.cart-action');
    const productId = Number($action.data('product-id'));
    const inCart = $action.hasClass('is-in-cart');
    const isDisabled = $(this).hasClass('is-disabled');

    if (!productId || isDisabled || inCart) return;

    requestCartUpdate(productId, 1, function () {
      updateCartActionState($action, 1);
      $action.addClass('open');
    });
  });

  $(document).on('keydown', '.add-to-cart', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      $(this).trigger('click');
    }
  });

  $(document).on('click', '.qty-plus', function () {
    const $action = $(this).closest('.cart-action');
    const productId = Number($action.data('product-id'));
    const stock = Number($action.data('stock') || 0);
    const current = Number($action.find('.qty-input').val() || 1);
    const next = clampQty(current + 1, stock);

    if (!productId) return;

    requestCartUpdate(productId, next, function () {
      updateCartActionState($action, next);
      $action.addClass('open');
    });
  });

  $(document).on('click', '.qty-minus', function () {
    const $action = $(this).closest('.cart-action');
    const productId = Number($action.data('product-id'));
    const stock = Number($action.data('stock') || 0);
    const current = Number($action.find('.qty-input').val() || 1);
    const next = clampQty(current - 1, stock);

    if (!productId) return;

    requestCartUpdate(productId, next, function () {
      updateCartActionState($action, next);
      $action.addClass('open');
    });
  });

  $(document).on('input', '.qty-input', function () {
    const $input = $(this);
    const stock = Number($input.closest('.cart-action').data('stock') || 0);
    $input.val(clampQty($input.val(), stock));
  });

  $(document).on('change', '.qty-input', function () {
    const $input = $(this);
    const $action = $input.closest('.cart-action');
    const productId = Number($action.data('product-id'));
    const stock = Number($action.data('stock') || 0);
    const next = clampQty($input.val(), stock);
    $input.val(next);

    if (!productId) return;

    requestCartUpdate(productId, next, function () {
      updateCartActionState($action, next);
      $action.addClass('open');
    });
  });

  $(document).on('click', '.qty-remove', function () {
    const $action = $(this).closest('.cart-action');
    const productId = Number($action.data('product-id'));

    if (!productId) return;

    $.ajax({
      url: `/api/cart/items/${productId}`,
      method: 'DELETE'
    })
      .done(function (response) {
        if (response.ok) {
          updateCartActionState($action, 0);
        }
      })
      .fail(function (xhr) {
        alert(xhr.responseJSON?.message || 'Ошибка удаления из корзины');
      });
  });

  function setWishlistState(productId, isWishlisted) {
    $(`.add-to-wishlist[data-id="${productId}"]`).each(function () {
      const $btn = $(this);
      const activeLabel = $btn.attr('data-label-active') || 'В избранном';
      const inactiveLabel = $btn.attr('data-label-inactive') || 'В избранное';

      if (isWishlisted) {
        $btn.addClass('is-active').text(activeLabel);
      } else {
        $btn.removeClass('is-active').text(inactiveLabel);
      }
    });
  }

  $(document).on('click', '.add-to-wishlist', function () {
    const $btn = $(this);
    const productId = Number($btn.data('id'));
    const isActive = $btn.hasClass('is-active');

    if (!productId) return;

    $.ajax({
      url: '/api/wishlist/items/toggle',
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({ product_id: productId, action: isActive ? 'remove' : 'add' })
    })
      .done(function (response) {
        if (response.ok) {
          setWishlistState(productId, Boolean(response.data && response.data.is_wishlisted));
        }
      })
      .fail(function (xhr) {
        if (xhr.status === 401) {
          window.location.href = '/auth/login';
        }
      });
  });

  $('.cart-remove').on('click', function () {
    const $card = $(this).closest('.cart-item');
    const productId = Number($card.data('product-id'));

    $.ajax({
      url: `/api/cart/items/${productId}`,
      method: 'DELETE'
    })
      .done(function (response) {
        if (!response.ok) return;

        $card.remove();
        if (response.data && response.data.pricing) {
          updateCartSummary(response.data.pricing);
        }
        if (!$('.cart-item').length) {
          window.location.reload();
        }
      })
      .fail(function (xhr) {
        alert(xhr.responseJSON?.message || 'Ошибка удаления из корзины');
      });
  });

  $(document).on('click', '.cart-page-plus', function () {
    const $card = $(this).closest('.cart-item');
    const $input = $card.find('.cart-qty');
    const stock = Number($input.data('stock') || 99);
    const current = Number($input.val() || 1);
    const next = clampQty(current + 1, stock);
    $input.val(next);
    triggerCartItemUpdate($card, next);
  });

  $(document).on('click', '.cart-page-minus', function () {
    const $card = $(this).closest('.cart-item');
    const $input = $card.find('.cart-qty');
    const stock = Number($input.data('stock') || 99);
    const current = Number($input.val() || 1);
    const next = clampQty(current - 1, stock);
    $input.val(next);
    triggerCartItemUpdate($card, next);
  });

  const cartInputTimers = {};

  $(document).on('input', '.cart-qty', function () {
    const $input = $(this);
    const $card = $input.closest('.cart-item');
    const productId = Number($card.data('product-id'));
    const stock = Number($input.data('stock') || 99);
    const clamped = clampQty($input.val(), stock);
    $input.val(clamped);

    if (cartInputTimers[productId]) {
      clearTimeout(cartInputTimers[productId]);
    }

    cartInputTimers[productId] = setTimeout(function () {
      triggerCartItemUpdate($card, clamped);
    }, 220);
  });

  $(document).on('change', '.cart-qty', function () {
    const $input = $(this);
    const $card = $input.closest('.cart-item');
    const stock = Number($input.data('stock') || 99);
    const clamped = clampQty($input.val(), stock);
    $input.val(clamped);
    triggerCartItemUpdate($card, clamped);
  });

  $('.qty-input').each(function () {
    const $input = $(this);
    const stock = Number($input.closest('.cart-action').data('stock') || 99);
    $input.attr('max', getMaxQty(stock));
  });

  $('.cart-qty').each(function () {
    const $input = $(this);
    const stock = Number($input.data('stock') || 99);
    $input.attr('max', getMaxQty(stock));
  });

  function syncFilterSelectState() {
    $('.filters select').each(function () {
      const $select = $(this);
      if (String($select.val() || '') === '') {
        $select.addClass('is-empty');
      } else {
        $select.removeClass('is-empty');
      }
    });
  }

  syncFilterSelectState();
  $(document).on('change', '.filters select', syncFilterSelectState);

  $(document).on('click', '.cart-promo-add', function () {
    const $input = $('#cart-promo-input');
    const code = String($input.val() || '').trim();
    if (!code) {
      setPromoMessage('Введите промокод', 'error');
      return;
    }

    $.ajax({
      url: '/api/cart/promos',
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({ code })
    }).done(function (response) {
      if (!response.ok) return;
      $input.val('');
      setPromoMessage('Промокод добавлен', 'success');
      if (response.data && response.data.pricing) {
        updateCartSummary(response.data.pricing);
      }
    }).fail(function (xhr) {
      setPromoMessage(xhr.responseJSON?.message || 'Не удалось активировать промокод', 'error');
    });
  });

  $(document).on('keydown', '#cart-promo-input', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      $('.cart-promo-add').trigger('click');
    }
  });

  $(document).on('click', '.promo-chip-remove', function () {
    const code = String($(this).data('code') || '').trim();
    if (!code) return;

    $.ajax({
      url: `/api/cart/promos/${encodeURIComponent(code)}`,
      method: 'DELETE'
    }).done(function (response) {
      if (!response.ok) return;
      if (response.data && response.data.pricing) {
        updateCartSummary(response.data.pricing);
      }
      setPromoMessage('Промокод удален', 'success');
    }).fail(function (xhr) {
      setPromoMessage(xhr.responseJSON?.message || 'Не удалось удалить промокод', 'error');
    });
  });

  $('.nav-toggle').on('click', function () {
    const $nav = $(this).closest('.main-nav');
    const opened = !$nav.hasClass('is-open');
    $nav.toggleClass('is-open', opened);
    $(this).attr('aria-expanded', opened ? 'true' : 'false');
  });

  $(document).on('click', '.main-nav-menu a, .main-nav-menu .link-btn', function () {
    const $nav = $(this).closest('.main-nav');
    $nav.removeClass('is-open');
    $nav.find('.nav-toggle').attr('aria-expanded', 'false');
  });

  $(window).on('resize', function () {
    if (window.innerWidth > 980) {
      $('.main-nav').removeClass('is-open');
      $('.nav-toggle').attr('aria-expanded', 'false');
    }
  });

  $(document).on('click', '.wishlist-remove', function () {
    const $card = $(this).closest('.wishlist-card');
    const productId = Number($card.data('product-id'));
    const $cancel = $card.find('.wishlist-cancel');
    const $remove = $(this);
    const $cancelFill = $cancel.find('.btn-progress-fill');

    $.ajax({
      url: '/api/wishlist/remove-jobs',
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({ product_id: productId })
    }).done(function (response) {
      if (!response.ok) return;

      const jobId = response.data.job_id;
      const seconds = response.data.seconds;
      $card.attr('data-job-id', jobId);

      $remove.hide();
      $cancel.show();
      $cancelFill.stop(true);
      $cancelFill.css({ width: '0%' });

      $cancelFill.animate({ width: '100%' }, seconds * 1000, 'linear', function () {
        $.ajax({
          url: `/api/wishlist/remove-jobs/${jobId}/execute`,
          method: 'POST'
        }).done(function (removeResponse) {
          if (removeResponse.ok && removeResponse.data.removed) {
            $card.fadeOut(250, function () { $(this).remove(); });
          }
        });
      });
    }).fail(function (xhr) {
      alert(xhr.responseJSON?.message || 'Ошибка удаления из избранного');
    });
  });

  $(document).on('click', '.wishlist-cancel', function () {
    const $card = $(this).closest('.wishlist-card');
    const jobId = Number($card.attr('data-job-id'));
    const $bar = $(this).find('.btn-progress-fill');
    const $cancel = $(this);
    const $remove = $card.find('.wishlist-remove');

    if (!jobId) return;

    $.ajax({
      url: `/api/wishlist/remove-jobs/${jobId}/cancel`,
      method: 'POST'
    }).done(function (response) {
      if (!response.ok) return;

      $bar.stop(true);
      $bar.css({ width: '0%' });
      $cancel.hide();
      $remove.show();
      $card.removeAttr('data-job-id');
    }).fail(function (xhr) {
      alert(xhr.responseJSON?.message || 'Ошибка отмены удаления');
    });
  });

  $(document).on('submit', 'form[action*="/admin/"][action*="/delete"], form[action*="/admin/"][action*="/hard-delete"]', function (e) {
    const action = $(this).attr('action') || '';
    const hardDelete = action.includes('/hard-delete');
    const message = hardDelete
      ? 'Удалить пользователя полностью? Это действие необратимо.'
      : 'Подтвердите удаление.';
    if (!window.confirm(message)) {
      e.preventDefault();
    }
  });
});
