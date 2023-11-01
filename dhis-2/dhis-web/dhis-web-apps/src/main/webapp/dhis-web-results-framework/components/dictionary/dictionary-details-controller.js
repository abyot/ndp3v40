/* Controllers */

/* global ndpFramework */

ndpFramework.controller('DictionaryDetailsController',
    function($scope,
            $modalInstance,
            dictionaryItem,
            fullFetched,
            DictionaryService,
            MetaDataFactory){

    $scope.dictionaryItem = dictionaryItem;
    $scope.model = {
        completeness: {
            green: ['displayName', 'code', 'periodType', 'computationMethod', 'indicatorType', 'preferredDataSource', 'rationale', 'responsibilityForIndicator', 'unit'],
            yellow: ['displayName', 'code', 'accountabilityForIndicator', 'computationMethod', 'preferredDataSource', 'unit'],
            invalid: ['isProgrammeDocument', 'isDocumentFolder']
        },
        dictionaryHeaders: [
            {id: 'displayName', name: 'name', colSize: "col-sm-1", show: true, fetch: false},
            {id: 'code', name: 'code', colSize: "col-sm-1", show: true, fetch: false},
            {id: 'aggregationType', name: 'aggregationType', colSize: "col-sm-1", show: true, fetch: false},
            {id: 'disaggregation', name: 'disaggregation', colSize: "col-sm-1", show: true, fetch: false},
            {id: 'valueType', name: 'valueType', colSize: "col-sm-1", show: true, fetch: false},
            {id: 'periodType', name: 'frequency', colSize: "col-sm-1", show: true, fetch: false},
            {id: 'vote', name: 'vote', colSize: 'col-sm-1', show: true, fetch: false}
        ],
        categoryCombosById: {}
    };

    MetaDataFactory.getAll('categoryCombos').then(function(categoryCombos){
        angular.forEach(categoryCombos, function(cc){
            $scope.model.categoryCombosById[cc.id] = cc;
        });

        MetaDataFactory.getAll('attributes').then(function(attributes){
            $scope.model.attributes = attributes;
            angular.forEach($scope.model.attributes, function(att){
                if(att['dataElementAttribute'] && $scope.model.completeness.invalid.indexOf(att.code) === -1 ){
                    var header = {id: att.code, name: att.name, show: false, fetch: true, colSize: "col-sm-1"};
                    $scope.model.dictionaryHeaders.push(header);
                }
            });
        });
    });

    $scope.model.dictionaryItem = dictionaryItem;
    $scope.model.fullFetched = fullFetched;

    if( $scope.dictionaryItem && !$scope.model.fullFetched){
        DictionaryService.getDataElement( $scope.dictionaryItem, $scope.model.dictionaryHeaders, $scope.model.completeness, $scope.model.categoryCombosById ).then(function( response ){
            $scope.model.dictionaryItem = response;
        });
    }

    $scope.close = function () {
        $modalInstance.close();
    };
});