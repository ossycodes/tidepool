import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import UiKeywords from '@/components/ui/UiKeywords.vue'

function mountKeywords(initial: string[] = []) {
  const words = ref(initial)
  const wrapper = mount(UiKeywords, {
    props: {
      label: 'Mute words',
      modelValue: words.value,
      'onUpdate:modelValue': (next: string[]) => {
        words.value = next
        void wrapper.setProps({ modelValue: next })
      },
    },
  })
  return { wrapper, words }
}

describe('UiKeywords', () => {
  it('adds words on Enter and commas, skipping duplicates', async () => {
    const { wrapper, words } = mountKeywords(['Rust'])
    const input = wrapper.find('input')
    await input.setValue('crypto, rust,  machine   learning ')
    await input.trigger('keydown', { key: 'Enter' })
    expect(words.value).toEqual(['Rust', 'crypto', 'machine learning'])
    expect(wrapper.findAll('.chip').map((c) => c.text())).toEqual([
      'Rust',
      'crypto',
      'machine learning',
    ])
  })

  it('removes a word with its button or Backspace on an empty field', async () => {
    const { wrapper, words } = mountKeywords(['a', 'b', 'c'])
    await wrapper.find('[aria-label="Remove b"]').trigger('click')
    expect(words.value).toEqual(['a', 'c'])
    await wrapper.find('input').trigger('keydown', { key: 'Backspace' })
    expect(words.value).toEqual(['a'])
  })
})
