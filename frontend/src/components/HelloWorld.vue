<template>
  <div>
    <table class="table">
      <thead>
        <tr>
          <th colspan="2">Company</th>
        </tr>
        <tr>
          <th>NAME</th>
          <th>AGE</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(item,key) in data" :key="key">
          <td>{{item.name}}</td>
          <td>{{item.age}}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
export default {
  name: 'HelloWorld',
  data(){
    return {
      data:{}
    }
  },
  methods: {
    getData(){
      this.axios.get(process.env.VUE_APP_Server_URL+"company").then(response=>{
        this.data = response.data
      })
    }
  },
  created() {
    this.getData()
  },
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
table,
td {
    border: 1px solid #333;
}

thead,
tfoot {
    background-color: #333;
    color: #fff;
}
</style>
