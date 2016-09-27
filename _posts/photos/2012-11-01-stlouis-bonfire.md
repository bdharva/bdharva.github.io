---
layout: gallery
title: St. Louis Bonfire
category: photography
tags: Photography
thumbnail: /assets/photography/bonfire/bonfire-2.jpg
---

{% assign name = "bonfire" %}
{% for i in (1..5) %}
[![](/assets/photography/{{ name }}/{{ name }}-{{ i }}.jpg)](/assets/photography/{{ name }}/{{ name }}-{{ i }}.jpg)
{% endfor %}