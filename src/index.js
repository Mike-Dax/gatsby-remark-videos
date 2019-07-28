const select = require(`unist-util-select`)
const path = require(`path`)
const isRelativeUrl = require(`is-relative-url`)
const _ = require(`lodash`)

const Promise = require(`bluebird`)
const slash = require(`slash`)

const { transcode } = require(`gatsby-plugin-ffmpeg`)

const allowedFiletypes = ['avi', 'mp4', 'mov', 'mkv']

module.exports = (
  { files, markdownNode, markdownAST, pathPrefix, getNode, reporter },
  pluginOptions
) => {
  const defaults = {
    pipelines: [
      {
        name: 'vp9',
        transcode: chain =>
          chain
            .videoCodec('libvpx-vp9')
            .noAudio()
            .outputOptions(['-crf 20', '-b:v 0']),
        maxHeight: 480,
        maxWidth: 900,
        fileExtension: 'webm',
      },
      {
        name: 'h264',
        transcode: chain => chain.videoCodec('libx264').noAudio(),
        maxHeight: 480,
        maxWidth: 900,
        fileExtension: 'mp4',
      },
    ],
  }

  const options = _.defaults(pluginOptions, defaults)

  // This will only work for markdown syntax image tags
  const markdownVideoNodes = select(markdownAST, `image`)

  // Takes a node and generates the needed videos and then returns
  // the needed HTML replacement for the video
  const generateVideosAndUpdateNode = async function(node, resolve) {
    // Check if this markdownNode has a File parent. This plugin
    // won't work if the video isn't hosted locally.
    const parentNode = getNode(markdownNode.parent)
    let videoPath
    if (parentNode && parentNode.dir) {
      videoPath = slash(path.join(parentNode.dir, node.url))
    } else {
      return null
    }

    const videoNode = _.find(files, file => {
      if (file && file.absolutePath) {
        return file.absolutePath === videoPath
      }
      return null
    })

    if (!videoNode || !videoNode.absolutePath) {
      return resolve()
    }

    let transcodeResult = await transcode({
      file: videoNode,
      options,
      reporter,
    })

    // Calculate the paddingBottom %

    const sourceTags = transcodeResult.videos.map(video => {
      return `<source src="${video.src}" type="video/${video.fileExtension}">`
    })
    /*
    console.log(
      transcodeResult.presentationMaxWidth,
      transcodeResult.presentationMaxHeight
    );
    */
    let wrapperAspectStyle
    let videoAspectStyle

    if (transcodeResult.aspectRatio < 1) {
      wrapperAspectStyle = `max-width: ${
        transcodeResult.presentationMaxWidth
      }px; max-height: ${
        transcodeResult.presentationMaxHeight
      }px; margin-left: auto; margin-right: auto;`
      videoAspectStyle = `height: 100%; width: 100%; margin: 0 auto; display: block; max-height: ${
        transcodeResult.presentationMaxHeight
      }px;`
    } else {
      // we're landscape, use the video aspect ratio to create a

      const ratio = `${(1 / transcodeResult.aspectRatio) * 100}%`

      wrapperAspectStyle = `position: relative; display: block; padding-top: ${ratio};`
      videoAspectStyle = `position: absolute; top: 0; left: 0; width: 100%; height: auto;`
    }

    const videoTag = `
    <video autoplay loop preload style="${videoAspectStyle}" >
      ${sourceTags.join('')}
    </video>
    `

    let rawHTML = `
      <div
      class="gatsby-video-aspect-ratio"
      style="${wrapperAspectStyle}"
      >${videoTag}</div>
    `

    return rawHTML
  }

  return Promise.all(
    // Simple because there is no nesting in markdown
    markdownVideoNodes.map(
      node =>
        new Promise(async (resolve, reject) => {
          const fileType = node.url.split('.').pop()

          if (isRelativeUrl(node.url) && allowedFiletypes.includes(fileType)) {
            const rawHTML = await generateVideosAndUpdateNode(node, resolve)

            if (rawHTML) {
              // Replace the video node with an inline HTML node.
              node.type = `html`
              node.value = rawHTML
            }
            return resolve(node)
          } else {
            // Video isn't relative so there's nothing for us to do.
            return resolve()
          }
        })
    )
  ).then(markdownVideoNodes => markdownVideoNodes.filter(node => !!node))
}
