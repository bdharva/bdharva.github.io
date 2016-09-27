---
layout: gallery
title: Rocky Mountain National Park
category: photography
tags: Photography
thumbnail: /assets/photography/rockymtnnp/rockymtnnp-4.jpg
---

{% assign name = "rockymtnnp" %}
{% for i in (1..4) %}
[![](/assets/photography/{{ name }}/{{ name }}-{{ i }}.jpg)](/assets/photography/{{ name }}/{{ name }}-{{ i }}.jpg)
{% endfor %}