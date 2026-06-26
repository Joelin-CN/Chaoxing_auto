
        async (page) => {
            const iframe = page.frames().find(f =>
                f !== page.mainFrame() &&
                (f.url().includes('mooc2') || f.url().includes('studentcourse'))
            );
            if (!iframe) return 'no-iframe';
            const links = await iframe.locator('a').all();
            for (const link of links) {
                const text = await link.textContent();
                if (text && text.includes('3.8')) {
                    await link.click();
                    return 'clicked:' + text.trim();
                }
            }
            return 'not-found';
        }
        