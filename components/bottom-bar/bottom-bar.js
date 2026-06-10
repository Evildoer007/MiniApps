Component({
  properties: {
    active: {
      type: String,
      value: 'basis'
    }
  },
  methods: {
    onTap: function (e) {
      var tab = e.currentTarget.dataset.tab;
      if (tab === this.data.active) return;
      this.triggerEvent('change', { tab: tab });
    }
  }
});
