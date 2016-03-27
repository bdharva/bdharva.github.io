---
layout: gallery
title: Stonehenge & Salisbury Cathedral
category: photography
tags: Photography
thumbnail: /assets/photography/salisburycathedral/salisburycathedral-3.jpg
---

{% assign name = "stonehenge" %}
{% for i in (1..2) %}
[![](/assets/photography/{{ name }}/{{ name }}-{{ i }}.jpg)](/assets/photography/{{ name }}/{{ name }}-{{ i }}.jpg)
{% endfor %}

{% assign name = "salisburycathedral" %}
{% for i in (1..5) %}
[![](/assets/photography/{{ name }}/{{ name }}-{{ i }}.jpg)](/assets/photography/{{ name }}/{{ name }}-{{ i }}.jpg)
{% endfor %}