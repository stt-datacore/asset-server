function imageSlot(url) {
	return `<div style='padding:0.4em' data-balloon-length="large" aria-label="${url}" data-balloon-pos="down"><a href="https://assets.datacore.app/${url}.png" target="_blank"><img src='https://assets.datacore.app/${url}.png' alt='${url}' height='200px' /></a></div>`;
}

fetch('https://assets.datacore.app/data/changelog.json')
	.then((res) => {
		res.json().then((data) => {
			let frag = document.createDocumentFragment();
			let hasBegun = true;
			data.reverse();
			data.forEach((ver) => {
				let temp = document.importNode(document.querySelector('template').content, true);

				let t = temp.querySelector.bind(temp);
				t('h2').textContent = ver.version;
				t('p').innerHTML = `${ver.newAssets.length} new assets:`;

				let crew = [];
				let items = [];
				let store = [];
				let others = [];
				ver.newAssets.forEach((url) => {
					if (url.startsWith('crew')) {
						if (!url.startsWith('crew_icons')) {
							crew.push(url);
						}
					} else if (url.startsWith('items')) {
						items.push(url);
					} else if (url.startsWith('store')) {
						store.push(url);
					} else {
						others.push(url);
					}
				});

				let container = document.createElement('div');
				let htmlCont = [];
				if (crew.length > 0) {
					htmlCont.push(`<div><h3>Crew</h3><div class='imggallery'>${crew.sort().map(imageSlot).join('')}</div></div>`);
				}
				if (items.length > 0) {
					htmlCont.push(`<div><h3>Items</h3><div class='imggallery'>${items.map(imageSlot).join('')}</div></div>`);
				}
				if (store.length > 0) {
					htmlCont.push(`<div><h3>Store offers</h3><div class='imggallery'>${store.map(imageSlot).join('')}</div></div>`);
				}
				if (others.length > 0) {
					htmlCont.push(`<div><h3>Misc</h3><div class='imggallery'>${others.map(imageSlot).join('')}</div></div>`);
				}
				container.innerHTML = `<div>${htmlCont.join('')}</div>`;
				t('div').appendChild(container);

				frag.appendChild(temp);

				if (hasBegun) {
					document.querySelector('output').textContent = '';
					hasBegun = false;
				}
				document.querySelector('output').appendChild(frag);
			});
		});
	})
	.catch((err) => console.error(`Error in fetching the URLs json (${err})`));
