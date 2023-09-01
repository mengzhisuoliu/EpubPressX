import { extractFromHtml, getSanitizeHtmlOptions, setSanitizeHtmlOptions } from '@extractus/article-extractor'
import JSZip from 'jszip';

const san = getSanitizeHtmlOptions()
san.allowedAttributes.img = ['src', 'alt', 'title']
setSanitizeHtmlOptions(san)

const template = {
    ['META-INF/container.xml']: function () {
        return `<?xml version="1.0" encoding="UTF-8" ?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
    <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
    </rootfiles>
</container>`
    },

    ['OEBPS/content.opf']: function (book, images) {
        return `<?xml version="1.0"?>
<package version="2.0" xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId">
    <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
        <dc:title>${book.title}</dc:title>
        <dc:language>en</dc:language>
        <dc:identifier id="BookId" opf:scheme="uuid">${book.id}</dc:identifier>
        <dc:creator opf:file-as="" opf:role="aut">EpubPressX</dc:creator>
        <meta name="cover" content="cover"/>
    </metadata>
    <manifest>
${book.pages.map((page, index) => `        <item id="chapter${index + 1}" href="chapter${index + 1}.xhtml" media-type="application/xhtml+xml"/>`).join('\n')}
        <item id="references" href="references.xhtml" media-type="application/xhtml+xml"/>
        <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
${images.map(image => `        <item id="${image.id}" href="${image.path}" media-type="${image.type}"/>`).join('\n')}
    </manifest>
    <spine toc="ncx">
${book.pages.map((page, index) => `        <itemref idref="chapter${index + 1}" />`).join('\n')}
        <itemref idref="references" />
    </spine>
</package>`
    },

    ['OEBPS/toc.ncx']: function (book) {
        return `<?xml version="1.0" encoding="UTF-8"?>
<ncx version="2005-1" xml:lang="en" xmlns="http://www.daisy.org/z3986/2005/ncx/">
    <head>
        <meta name="dtb:uid" content="${book.id}"/> <!-- same as in .opf -->
        <meta name="dtb:depth" content="1"/> <!-- 1 or higher -->
        <meta name="dtb:totalPageCount" content="0"/> <!-- must be 0 -->
        <meta name="dtb:maxPageNumber" content="0"/> <!-- must be 0 -->
    </head>
    <docTitle>
        <text>${book.title}</text>
    </docTitle>
    <docAuthor>
        <text>EpubPressX</text>
    </docAuthor>
    <navMap>
${book.pages.map((page, index) => `        <navPoint id="chapter${index + 1}" playOrder="${index + 1}">
            <navLabel><text>${page.title}</text></navLabel>
            <content src="chapter${index + 1}.xhtml"/>
        </navPoint>`).join('\n')}
        <navPoint id="references" playOrder="${book.pages.length + 1}">
            <navLabel><text>References</text></navLabel>
            <content src="references.xhtml"/>
        </navPoint>
    </navMap>
</ncx>`
    },

    chapter: function (title, content) {
        return `<?xml version="1.0" encoding="UTF-8" ?>
<html xmlns="http://www.w3.org/1999/xhtml">
    <head>
        <title>${title}</title>
        <style>
            body {
                font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji";
            }
        </style>
    </head>
    <body>
        <h2>${title}</h2>
        ${content}
    </body>
</html>`
    },

    references: function (book) {
        return `<?xml version="1.0" encoding="UTF-8" ?>
<html xmlns="http://www.w3.org/1999/xhtml">
    <head>
        <title>References</title>
        <style>
            li {
                word-break: break-all;
            }
        </style>
    </head>
    <body>
        <h2>References</h2>
        <ol>
${book.pages.map((page) => `            <li><a href="${page.url}">${page.title} (${page.url})</a></li>`).join('\n')}
        </ol>
    </body>
</html>`
    }
}

// [{ url, id, path, type, blob }]
const imagesList = [];

//  将 html 中的 img 的 url 转换成本地 url
async function replaceImages(html) {
    const dom = new DOMParser().parseFromString(html, 'text/xml');
    const images = dom.querySelectorAll('img');
    images.forEach((image, index) => {    
        const src = image.src;
        if (src) {
            const id = index + '_' + src.split('/').pop();
            const path = 'image/' + id
            image.src = path;
            imagesList.push({ src, id, path });
        }
    })
    return new XMLSerializer().serializeToString(dom);
}

function downloadAllImages() {
    const promises = [];
    for (const image of imagesList) {
        promises.push(new Promise((resolve, reject) => {
            fetch(image.src).then(res => {
                image.type = res.headers.get('Content-Type');
                res.blob().then(blob => {
                    image.blob = blob;
                    resolve()
                })
            }).catch(error => {
                reject(error)
            })
        }))
    }
    return Promise.all(promises)
}

/**
 * 生成 epub 格式的电子书
 * @param {*} pages [{title: '', content: ''}]
 * @returns 
 */
export async function generateEpub(book) {
    imagesList.length = 0;
    book.id = `book-${Date.now()}`

    book.pages = []
    for(const section of book.sections) {
        const page = await extractFromHtml(section.html, section.url)
        if (page) {
            book.pages.push(page)
        }
    }

    const zip = new JSZip();
    zip.file('mimetype', 'application/epub+zip');
    zip.file('META-INF/container.xml', template['META-INF/container.xml']());
    zip.file('OEBPS/toc.ncx', template['OEBPS/toc.ncx'](book));
    book.pages.forEach(async (page, index) => {
        let xml = template.chapter(page.title, page.content)
        xml = await replaceImages(xml);
        zip.file(`OEBPS/chapter${index + 1}.xhtml`, xml);
    })
    zip.file('OEBPS/references.xhtml', template.references(book));

    // 封面图片
    const coverPath = book.coverPath?.trim() || imagesList[0]?.src;
    if (coverPath) {
        imagesList.push({
            src: coverPath,
            id: 'cover',
            path: 'image/cover' + coverPath.split('/').pop(),
        });
    }
    
    try {
        await downloadAllImages();
    } catch (error) {
        console.error(error)
    }
    for (const image of imagesList) {
        zip.file('OEBPS/' + image.path, image.blob);
    }
    zip.file('OEBPS/content.opf', template['OEBPS/content.opf'](book, imagesList));
    return zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' })
}
