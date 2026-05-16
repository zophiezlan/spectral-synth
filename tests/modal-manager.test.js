/**
 * Unit Tests for ModalManager + Modal
 *
 * The cleanup contract is the load-bearing bit: a Modal's keydown listener is
 * attached on open() and must be removed on close()/destroy(), or it leaks.
 * These tests lock that contract in.
 */

const { loadBrowserModule } = require('./test-helpers');

function loadModal() {
    return loadBrowserModule('modal-manager.js', {
        document,
        window,
        HTMLElement,
        Event,
        KeyboardEvent,
        MouseEvent,
        AppState: undefined,
    });
}

function setupDOM() {
    document.body.innerHTML = `
        <button id="trigger-btn">Open</button>
        <div id="my-modal" class="hidden" style="display: none">
            <button id="close-btn">Close</button>
            <input id="first-input" />
        </div>
    `;
}

function countDocumentKeydownListeners(addSpy, removeSpy) {
    const added = addSpy.mock.calls.filter(([type]) => type === 'keydown').length;
    const removed = removeSpy.mock.calls.filter(([type]) => type === 'keydown').length;
    return added - removed;
}

describe('Modal', () => {
    let Modal;
    let addSpy;
    let removeSpy;

    beforeEach(() => {
        ({ Modal } = loadModal());
        setupDOM();
        addSpy = jest.spyOn(document, 'addEventListener');
        removeSpy = jest.spyOn(document, 'removeEventListener');
    });

    afterEach(() => {
        addSpy.mockRestore();
        removeSpy.mockRestore();
    });

    describe('open()', () => {
        it('shows the modal and flips isOpen', () => {
            const modal = new Modal({ modalId: 'my-modal' });

            modal.open();

            expect(modal.isOpen).toBe(true);
            expect(modal.modal.classList.contains('hidden')).toBe(false);
            expect(modal.modal.style.display).toBe('flex');
        });

        it('attaches one keydown listener to document', () => {
            const modal = new Modal({ modalId: 'my-modal' });

            modal.open();

            expect(countDocumentKeydownListeners(addSpy, removeSpy)).toBe(1);
        });

        it('invokes onOpen callback', () => {
            const onOpen = jest.fn();
            const modal = new Modal({ modalId: 'my-modal', onOpen });

            modal.open();

            expect(onOpen).toHaveBeenCalledTimes(1);
        });

        it('swallows onOpen errors without throwing', () => {
            const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const modal = new Modal({
                modalId: 'my-modal',
                onOpen: () => { throw new Error('boom'); },
            });

            expect(() => modal.open()).not.toThrow();
            expect(modal.isOpen).toBe(true);
            expect(errSpy).toHaveBeenCalled();
            errSpy.mockRestore();
        });

        it('is idempotent when already open', () => {
            const onOpen = jest.fn();
            const modal = new Modal({ modalId: 'my-modal', onOpen });

            modal.open();
            modal.open();

            expect(onOpen).toHaveBeenCalledTimes(1);
            expect(countDocumentKeydownListeners(addSpy, removeSpy)).toBe(1);
        });
    });

    describe('close()', () => {
        it('removes the keydown listener it added', () => {
            const modal = new Modal({ modalId: 'my-modal' });

            modal.open();
            modal.close();

            expect(countDocumentKeydownListeners(addSpy, removeSpy)).toBe(0);
        });

        it('invokes onClose callback', () => {
            const onClose = jest.fn();
            const modal = new Modal({ modalId: 'my-modal', onClose });

            modal.open();
            modal.close();

            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('does nothing when already closed', () => {
            const onClose = jest.fn();
            const modal = new Modal({ modalId: 'my-modal', onClose });

            modal.close();

            expect(onClose).not.toHaveBeenCalled();
        });
    });

    describe('ESC key', () => {
        it('closes the modal when closeOnEscape is true (default)', () => {
            const modal = new Modal({ modalId: 'my-modal' });
            modal.open();

            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

            expect(modal.isOpen).toBe(false);
        });

        it('ignores ESC when closeOnEscape is false', () => {
            const modal = new Modal({ modalId: 'my-modal', closeOnEscape: false });
            modal.open();

            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

            expect(modal.isOpen).toBe(true);
        });

        it('does nothing when the modal is closed', () => {
            const modal = new Modal({ modalId: 'my-modal' });

            // Modal never opened, so its keydown handler isn't attached anyway.
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

            expect(modal.isOpen).toBe(false);
        });
    });

    describe('overlay click', () => {
        it('closes when the overlay (modal element itself) is clicked', () => {
            const modal = new Modal({ modalId: 'my-modal' });
            modal.open();

            modal.modal.dispatchEvent(new MouseEvent('click', { bubbles: true }));

            expect(modal.isOpen).toBe(false);
        });

        it('does not close when an inner element is clicked', () => {
            const modal = new Modal({ modalId: 'my-modal' });
            modal.open();

            const inner = document.getElementById('first-input');
            inner.dispatchEvent(new MouseEvent('click', { bubbles: true }));

            expect(modal.isOpen).toBe(true);
        });
    });

    describe('destroy()', () => {
        it('removes overlay + keydown listeners', () => {
            const modal = new Modal({ modalId: 'my-modal' });
            modal.open();
            const baselineKeydown = countDocumentKeydownListeners(addSpy, removeSpy);
            const overlayRemoveSpy = jest.spyOn(modal.modal, 'removeEventListener');

            modal.destroy();

            expect(countDocumentKeydownListeners(addSpy, removeSpy)).toBeLessThan(baselineKeydown);
            const removedTypes = overlayRemoveSpy.mock.calls.map(([type]) => type);
            expect(removedTypes).toContain('click');
        });
    });

    describe('missing element', () => {
        it('warns and skips listener setup when modalId is not in DOM', () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

            const modal = new Modal({ modalId: 'does-not-exist' });
            modal.open();

            expect(warnSpy).toHaveBeenCalled();
            expect(modal.isOpen).toBe(false);
            warnSpy.mockRestore();
        });
    });
});

describe('ModalManager', () => {
    let ModalManager;

    beforeEach(() => {
        ({ ModalManager } = loadModal());
        setupDOM();
    });

    afterEach(() => {
        ModalManager.destroyAll();
    });

    it('registers and returns a Modal instance', () => {
        const m = ModalManager.register('mine', { modalId: 'my-modal' });
        expect(m).toBeDefined();
        expect(ModalManager.get('mine')).toBe(m);
    });

    it('rejects duplicate registration and returns the first instance', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const first = ModalManager.register('mine', { modalId: 'my-modal' });
        const second = ModalManager.register('mine', { modalId: 'my-modal' });

        expect(second).toBe(first);
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });

    it('opens and closes by name', () => {
        const modal = ModalManager.register('mine', { modalId: 'my-modal' });

        ModalManager.open('mine');
        expect(modal.isOpen).toBe(true);
        expect(ModalManager.isAnyOpen()).toBe(true);
        expect(ModalManager.getOpenModals()).toEqual(['mine']);

        ModalManager.close('mine');
        expect(modal.isOpen).toBe(false);
        expect(ModalManager.isAnyOpen()).toBe(false);
    });

    it('closeAll() closes every open modal', () => {
        document.body.insertAdjacentHTML(
            'beforeend',
            '<div id="other-modal" class="hidden" style="display:none"></div>'
        );
        const a = ModalManager.register('a', { modalId: 'my-modal' });
        const b = ModalManager.register('b', { modalId: 'other-modal' });

        a.open();
        b.open();
        expect(ModalManager.isAnyOpen()).toBe(true);

        ModalManager.closeAll();
        expect(a.isOpen).toBe(false);
        expect(b.isOpen).toBe(false);
    });

    it('open() on unknown name warns rather than throwing', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        expect(() => ModalManager.open('ghost')).not.toThrow();
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });
});
