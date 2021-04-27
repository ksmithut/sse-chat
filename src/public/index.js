const messages = document.getElementById('messages')
const inputForm = document.getElementById('input-form')
if (!messages) throw new Error('No element with id "messages"')
if (!inputForm) throw new Error('No element with id "inputForm"')
if (!(inputForm instanceof window.HTMLFormElement)) {
  throw new Error('"inputForm was not a Form Element')
}

const source = new window.EventSource('/messages')

source.addEventListener('message', event => {
  const data = JSON.parse(event.data)
  const node = document.createElement('p')
  node.innerText = data.message
  messages.appendChild(node)
})

inputForm.addEventListener('submit', event => {
  event.preventDefault()
  const message = inputForm.elements.namedItem('message')
  if (!(message instanceof window.HTMLInputElement)) return
  const body = {
    message: message.value
  }
  message.disabled = true
  window
    .fetch(inputForm.action, {
      method: inputForm.method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })
    .then(res => {
      if (res.status === 201) {
        message.value = ''
      } else {
        throw Object.assign(new Error('Error submitting text'), {
          res
        })
      }
    })
    .catch(err => {
      console.error(err)
    })
    .finally(() => {
      message.disabled = false
      message.focus()
    })
})
